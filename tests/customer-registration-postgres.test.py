"""Registration regression tests against a disposable local cluster, never Cloud data."""
import importlib.util
import concurrent.futures
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('booking_fixture', ROOT / 'tests/atomic-booking-postgres.test.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class CustomerRegistrationTests(fixture.AtomicBookingTests):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.sql("""
          ALTER TABLE public.clientes ALTER COLUMN id SET DEFAULT gen_random_uuid();
          ALTER TABLE public.clientes ADD COLUMN telefone text, ADD COLUMN origem_cliente text,
            ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
          GRANT INSERT ON public.clientes TO authenticated;
          CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated
            WITH CHECK (owner_id = current_owner_id() AND has_any_role(auth.uid(), ARRAY['owner','admin','gerente','atendente']::public.app_role[]));
        """)
        cls.sql((ROOT / 'drizzle/migrations/0003_safe_customer_registration.sql').read_text())

    def setUp(self):
        super().setUp()
        self.sql("DELETE FROM public.clientes WHERE nome LIKE 'Synthetic%';")

    def register(self, phone='(11) 90000-1234', name='Synthetic Test', user=fixture.OWNER, ok=True, role='authenticated'):
        result = self.sql(f"SELECT cadastrar_cliente_seguro('{name}','{phone}','Teste');", user=user, ok=ok, role=role)
        return json.loads(result) if ok else result

    def test_registration_concurrent_clicks_create_one_customer(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            results = list(pool.map(lambda _: self.register(), range(24)))
        self.assertEqual(len({r['cliente']['id'] for r in results}), 1)
        self.assertEqual(sum(not r['existente'] for r in results), 1)

    def test_registration_formatted_phone_and_country_code_reuse_existing(self):
        original = self.register()
        duplicate = self.register('+5511900001234', name='Synthetic Changed')
        self.assertTrue(duplicate['existente'])
        self.assertEqual(duplicate['cliente']['id'], original['cliente']['id'])
        self.assertEqual(duplicate['cliente']['nome'], 'Synthetic Test')

    def test_registration_same_phone_different_tenant_never_returns_other_customer(self):
        original = self.register()
        other = self.register(user=fixture.OTHER)
        self.assertFalse(other['existente'])
        self.assertNotEqual(original['cliente']['id'], other['cliente']['id'])
        self.assertEqual(other['cliente']['owner_id'], fixture.OTHER)

    def test_registration_attendant_allowed_washer_denied(self):
        self.assertFalse(self.register(user=fixture.ATTENDANT)['existente'])
        self.assertIn('permissão', self.register(user=fixture.WASHER, ok=False))

    def test_registration_anonymous_denied(self):
        self.assertIn('permission denied', self.register(user='', role='anon', ok=False))

    def test_registration_blank_name_rejected_without_insert(self):
        self.assertIn('inválidos', self.register(name='   ', ok=False))
        self.assertEqual(self.sql("SELECT count(*) FROM clientes WHERE nome LIKE 'Synthetic%';"), '0')

    def test_registration_without_phone_reuses_exact_name(self):
        original = self.register(phone='')
        duplicate = self.register(phone='', name='synthetic test')
        self.assertTrue(duplicate['existente'])
        self.assertEqual(original['cliente']['id'], duplicate['cliente']['id'])

    def test_booking_customer_reference_is_tenant_scoped(self):
        self.assertEqual(self.sql(f"SELECT booking_references_valid('{fixture.OWNER}','{fixture.CLIENT}',NULL,NULL,NULL);", user=fixture.ATTENDANT), 't')
        self.assertEqual(self.sql(f"SELECT booking_references_valid('{fixture.OTHER}','{fixture.CLIENT}',NULL,NULL,NULL);", user=fixture.OTHER), 'f')

    def test_booking_reference_validator_rejects_washer(self):
        self.assertEqual(self.sql(f"SELECT booking_references_valid('{fixture.OWNER}','{fixture.CLIENT}',NULL,NULL,NULL);", user=fixture.WASHER), 'f')


if __name__ == '__main__':
    unittest.main(verbosity=2)