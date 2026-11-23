"""Real concurrent PostgreSQL tests on a disposable UNIX-socket-only cluster.

Run: python3 tests/atomic-booking-postgres.test.py
Never connects to the application's backend or consumes production credentials.
"""
import concurrent.futures
import os
from pathlib import Path
import pwd
import subprocess
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
OWNER = '00000000-0000-0000-0000-000000000001'
OTHER = '00000000-0000-0000-0000-000000000002'
ATTENDANT = '00000000-0000-0000-0000-000000000003'
WASHER = '00000000-0000-0000-0000-000000000004'
CLIENT = '10000000-0000-0000-0000-000000000001'
EMPLOYEE = '20000000-0000-0000-0000-000000000001'
FALLBACK = '20000000-0000-0000-0000-000000000003'
SERVICE = '30000000-0000-0000-0000-000000000001'
VEHICLE = '40000000-0000-0000-0000-000000000001'


class AtomicBookingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = Path(tempfile.mkdtemp(prefix='lavaflow-pg-', dir='/tmp'))
        account = pwd.getpwnam('nobody') if os.geteuid() == 0 else pwd.getpwuid(os.geteuid())
        cls.dbuser = account.pw_name
        cls.prefix = ['runuser', '-u', account.pw_name, '--'] if os.geteuid() == 0 else []
        os.chown(cls.folder, account.pw_uid, account.pw_gid)
        cls.datadir = cls.folder / 'data'
        subprocess.run(cls.prefix + ['initdb', '-D', str(cls.datadir), '--no-locale', '-A', 'trust'], check=True, capture_output=True)
        subprocess.run(cls.prefix + ['pg_ctl', '-D', str(cls.datadir), '-l', str(cls.folder / 'postgres.log'), '-o', f"-k {cls.folder} -c listen_addresses=''", '-w', 'start'], check=True, capture_output=True)
        cls.sql((ROOT / 'tests/fixtures/atomic-booking-schema.sql').read_text())
        cls.sql((ROOT / 'supabase/migrations/20261121180500_agendamento_capacity_atomic_guard.sql').read_text())
        cls.sql((ROOT / 'supabase/migrations/20261121180700_atomic_booking_to_work_order.sql').read_text())
        # During development use the reviewed candidate; after migration use its saved copy.
        candidate = ROOT / 'tests/fixtures/atomic-booking-hardening.sql'
        saved = list((ROOT / 'supabase/migrations').glob('*atomic_booking_reference_validation*.sql'))
        cls.sql((saved[0] if saved else candidate).read_text())

    @classmethod
    def tearDownClass(cls):
        subprocess.run(cls.prefix + ['pg_ctl', '-D', str(cls.datadir), '-m', 'immediate', '-w', 'stop'], check=True, capture_output=True)
        import shutil
        shutil.rmtree(cls.folder)

    @classmethod
    def sql(cls, text, user=None, role='authenticated', ok=True):
        if user is not None:
            text = f"SET ROLE {role}; SET request.jwt.claim.sub='{user}';" + text
        result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', str(cls.folder), '-U', cls.dbuser, '-d', 'postgres'], input=text, text=True, capture_output=True)
        if ok and result.returncode != 0:
            raise AssertionError(result.stderr)
        if not ok and result.returncode == 0:
            raise AssertionError('Expected PostgreSQL to reject the operation')
        return result.stdout.strip() if ok else result.stderr

    def setUp(self):
        self.sql('TRUNCATE public.agendamentos,public.ordens_servico;')

    def booking(self, patch=''):
        ident = str(uuid.uuid4())
        self.sql(f"INSERT INTO public.agendamentos(id,owner_id,cliente_id,servico_id,veiculo_id,funcionario_id,data_agendada,hora_agendada,leva_traz,taxa_leva_traz,observacoes) VALUES ('{ident}','{OWNER}','{CLIENT}','{SERVICE}','{VEHICLE}','{EMPLOYEE}','2030-01-01','10:00',true,20,'Fixture');" + (f"UPDATE public.agendamentos SET {patch} WHERE id='{ident}';" if patch else ''))
        return ident

    def convert(self, ident, user=OWNER, owner=OWNER, fallback=None, ok=True):
        arg = f"'{fallback}'" if fallback else 'NULL'
        return self.sql(f"SELECT public.iniciar_atendimento_atomico('{owner}','{ident}',{arg});", user=user, ok=ok)

    def test_concurrent_conversion_creates_one_order(self):
        ident = self.booking()
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            orders = list(pool.map(lambda _: self.convert(ident), range(24)))
        self.assertEqual(len(set(orders)), 1)
        self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '1')
        self.assertEqual(self.sql(f"SELECT status||'|'||ordem_id||'|'||leva_traz_status FROM public.agendamentos WHERE id='{ident}';"), f'em_andamento|{orders[0]}|em_servico')

    def test_retry_returns_same_order(self):
        ident = self.booking()
        self.assertEqual(self.convert(ident), self.convert(ident))
        self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '1')

    def test_existing_employee_wins_and_price_includes_transport(self):
        ident = self.booking()
        order = self.convert(ident, fallback=FALLBACK)
        self.assertEqual(self.sql(f"SELECT funcionario_id||'|'||valor||'|'||status||'|'||observacoes FROM public.ordens_servico WHERE id='{order}';"), f'{EMPLOYEE}|100|aguardando|Fixture')

    def test_missing_employee_uses_authenticated_fallback(self):
        ident = self.booking('funcionario_id=NULL')
        order = self.convert(ident, fallback=FALLBACK)
        self.assertEqual(self.sql(f"SELECT funcionario_id FROM public.ordens_servico WHERE id='{order}';"), FALLBACK)

    def test_optional_service_and_employee_remain_optional(self):
        ident = self.booking('funcionario_id=NULL,servico_id=NULL,veiculo_id=NULL,taxa_leva_traz=0,leva_traz=false')
        order = self.convert(ident)
        self.assertEqual(self.sql(f"SELECT valor FROM public.ordens_servico WHERE id='{order}';"), '0')

    def test_attendant_can_convert_without_reading_employee_data(self):
        ident = self.booking()
        self.assertEqual(self.sql('SELECT count(*) FROM public.funcionarios;', user=ATTENDANT), '0')
        self.assertTrue(self.convert(ident, user=ATTENDANT))

    def test_wrong_tenant_is_rejected(self):
        ident = self.booking()
        self.assertIn('permissão', self.convert(ident, user=OTHER, ok=False))
        self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '0')

    def test_wrong_owner_filter_is_rejected(self):
        ident = self.booking()
        self.assertIn('permissão', self.convert(ident, owner=OTHER, ok=False))

    def test_washer_role_is_rejected(self):
        self.assertIn('permissão', self.convert(self.booking(), user=WASHER, ok=False))

    def test_anonymous_and_service_without_user_are_rejected(self):
        ident = self.booking()
        query = f"SELECT public.iniciar_atendimento_atomico('{OWNER}','{ident}',NULL);"
        self.assertIn('permission denied', self.sql(query, user='', role='anon', ok=False))
        self.assertIn('permissão', self.sql(query, user='', role='service_role', ok=False))

    def test_terminal_bookings_cannot_create_an_order(self):
        for status in ['cancelado', 'nao_compareceu', 'concluido']:
            self.sql('TRUNCATE public.agendamentos,public.ordens_servico;')
            self.assertIn('encerrado', self.convert(self.booking(f"status='{status}'"), ok=False))
            self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '0')

    def test_cross_tenant_or_wrong_customer_references_are_rejected(self):
        for patch in [
            "funcionario_id='20000000-0000-0000-0000-000000000002'",
            "cliente_id='10000000-0000-0000-0000-000000000002'",
            "servico_id='30000000-0000-0000-0000-000000000002'",
            "veiculo_id='40000000-0000-0000-0000-000000000002'",
            "veiculo_id='40000000-0000-0000-0000-000000000003'",
        ]:
            self.sql('TRUNCATE public.agendamentos,public.ordens_servico;')
            self.assertIn('Referências', self.convert(self.booking(patch), ok=False))
            self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '0')

    def test_link_to_another_tenant_order_is_rejected(self):
        ident = self.booking()
        foreign = str(uuid.uuid4())
        self.sql(f"INSERT INTO public.ordens_servico(id,owner_id,cliente_id) VALUES ('{foreign}','{OTHER}','10000000-0000-0000-0000-000000000002'); UPDATE public.agendamentos SET ordem_id='{foreign}' WHERE id='{ident}';")
        self.assertIn('Vínculo', self.convert(ident, ok=False))

    def test_update_failure_rolls_back_insert(self):
        ident = self.booking()
        self.sql("CREATE FUNCTION public.fixture_fail_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$; CREATE TRIGGER fixture_fail_update BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_update();")
        try:
            self.assertIn('fixture rollback', self.convert(ident, ok=False))
            self.assertEqual(self.sql('SELECT count(*) FROM public.ordens_servico;'), '0')
            self.assertEqual(self.sql(f"SELECT status||'|'||coalesce(ordem_id::text,'NULL') FROM public.agendamentos WHERE id='{ident}';"), 'agendado|NULL')
        finally:
            self.sql('DROP TRIGGER fixture_fail_update ON public.agendamentos; DROP FUNCTION public.fixture_fail_update();')


if __name__ == '__main__':
    unittest.main(verbosity=2)