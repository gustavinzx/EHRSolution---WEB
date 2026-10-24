-- Migration 020: Reconciliar caminhoes presos em status='security_alert'
-- Um caminhao so deve ficar em 'security_alert' enquanto houver ao menos um fleet_alerts
-- NAO resolvido de tipo critico (prefixo security_). Idempotente: reexecutar nao altera nada novo.
UPDATE trucks
   SET status = 'ok'
 WHERE status = 'security_alert'
   AND NOT EXISTS (
     SELECT 1 FROM fleet_alerts a
      WHERE a.truck_id = trucks.id
        AND a.resolved_at IS NULL
        AND a.type IN (
          'security_tamper',
          'security_unauthorized_movement',
          'security_emergency_button',
          'security_theft_signal',
          'security_unauthorized_fueling_attempt'
        )
   );
