import { useGTMStore } from '../store/gtm-store';
import { useDatalayerStore } from '../features/datalayer-mapping/stores/datalayerStore';
import { useTrackingPlanStore } from '../features/tracking-plan/stores/trackingPlanStore';
import { TEST_CLIENT_ID, TEST_TRACKING_PLAN } from '../data/test-container-mock';

// Container de test / bac à sable (2026-07-14) — un seul point d'entrée qui peuple les 3
// stores d'un coup avec un jeu de données cohérent (même containerId GTM que siteId DataLayer
// Mapping), pour itérer sur l'UI sans attendre un vrai container connecté ni Supabase.
export function seedTestContainer() {
  useGTMStore.getState().seedTestContainer();
  useDatalayerStore.getState().loadTestContainer();
  useTrackingPlanStore.getState().loadPlan(TEST_CLIENT_ID, TEST_TRACKING_PLAN);
}
