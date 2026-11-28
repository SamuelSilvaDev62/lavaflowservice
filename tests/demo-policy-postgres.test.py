"""Demo classification/RLS/metrics tests against a disposable database only."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('booking_fixture', ROOT / 'tests/atomic-booking-postgres.test.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class DemoPolicyTests(fixture.AtomicBookingTests):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.sql("""
          CREATE TABLE public.empresa (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid UNIQUE NOT NULL);
          CREATE TABLE public.tenant_subscriptions (owner_id uuid PRIMARY KEY, plan text, subscription_status text);
          GRANT SELECT ON public.tenant_subscriptions TO authenticated;
          GRANT ALL ON public.empresa, public.tenant_subscriptions TO service_role;
          ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
          CREATE POLICY subscription_read ON public.tenant_subscriptions FOR SELECT TO authenticated
            USING (owner_id = current_owner_id());
          INSERT INTO public.empresa(owner_id) VALUES
            ('00000000-0000-0000-0000-000000000001'),
            ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000005');
          INSERT INTO public.tenant_subscriptions VALUES
            ('00000000-0000-0000-0000-000000000001',NULL,'none'),
            ('00000000-0000-0000-0000-000000000002','growth','active');
        """)
        cls.sql((ROOT / 'drizzle/migrations/0006_permanent_demo_tenant_policy.sql').read_text())
        cls.sql(f"SET ROLE service_role; UPDATE public.tenant_subscriptions SET is_demo=true WHERE owner_id='{fixture.OWNER}';")

    def test_demo_read_scope_and_other_subscription_unchanged(self):
        self.assertEqual(self.sql('SELECT is_demo FROM tenant_subscriptions;', user=fixture.OWNER), 't')
        self.assertEqual(self.sql('SELECT is_demo FROM tenant_subscriptions;', user=fixture.ATTENDANT), 't')
        self.assertEqual(self.sql('SELECT is_demo FROM tenant_subscriptions;', user=fixture.OTHER), 'f')
        self.assertEqual(self.sql('SELECT plan FROM tenant_subscriptions;', user=fixture.OTHER), 'growth')
        self.assertIn('permission denied', self.sql('SELECT is_demo FROM tenant_subscriptions;', user='', role='anon', ok=False))

    def test_demo_flag_cannot_be_self_granted(self):
        self.assertIn('permission denied', self.sql('UPDATE tenant_subscriptions SET is_demo=true;', user=fixture.OTHER, ok=False))
        # Defense in depth: even an accidental future UPDATE grant/policy cannot self-grant.
        self.sql("GRANT UPDATE ON public.tenant_subscriptions TO authenticated; CREATE POLICY temporary_update ON public.tenant_subscriptions FOR UPDATE TO authenticated USING(owner_id=current_owner_id()) WITH CHECK(owner_id=current_owner_id());")
        try:
            self.assertIn('privileged authorization', self.sql('UPDATE tenant_subscriptions SET is_demo=true;', user=fixture.OTHER, ok=False))
        finally:
            self.sql('DROP POLICY temporary_update ON public.tenant_subscriptions; REVOKE UPDATE ON public.tenant_subscriptions FROM authenticated;')

    def test_platform_metrics_scope_excludes_demo_including_usage(self):
        self.assertEqual(self.sql('SELECT count(*) FROM admin_real_tenants;', user='', role='service_role'), '2')
        for role in ['authenticated', 'anon']:
            self.assertIn('permission denied', self.sql('SELECT * FROM admin_real_tenants;', user=fixture.OTHER, role=role, ok=False))
        # The same scope applies to customer/revenue/retention/usage aggregates.
        totals = self.sql(f"""SET ROLE service_role;
          WITH facts(owner_id,customers,revenue,retained,usage) AS (VALUES
            ('{fixture.OWNER}'::uuid, 99, 9999, 90, 100),
            ('{fixture.OTHER}'::uuid, 2, 80, 1, 3))
          SELECT sum(customers),sum(revenue),sum(retained),sum(usage)
          FROM facts WHERE owner_id IN (SELECT owner_id FROM admin_real_tenants);
        """)
        self.assertEqual(totals, '2|80|1|3')


if __name__ == '__main__':
    # Run the focused tests; the inherited fixture suite is tested separately.
    suite = unittest.TestSuite(DemoPolicyTests(name) for name in [
        'test_demo_read_scope_and_other_subscription_unchanged',
        'test_demo_flag_cannot_be_self_granted',
        'test_platform_metrics_scope_excludes_demo_including_usage',
    ])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())