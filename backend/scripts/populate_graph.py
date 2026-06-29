import os
import sys
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.memory import add_incident_report

incident_reports = [
    # === Core Topology ===
    "System Topology: Payment-Gateway is a P0 service owned by the Checkout team with a 99.99 SLO target. Payment-Gateway depends on Auth-Service and Billing-DB. Auth-Service is a P1 service owned by the Identity team with a 99.9 SLO target. Auth-Service depends on Auth-DB. Billing-DB is a P0 database service owned by the Database team. Alert CPU-Threshold exceeded 95% was triggered on Billing-DB at 2026-06-22T10:00:00Z. Runbook Flush-DB-Pools-Guide contains steps: 1. check pool size, 2. execute flush script, 3. verify active connections. Runbook Restart-Service-Guide contains steps: 1. send sigterm, 2. wait, 3. systemctl restart.",

    # === Incident 101: Auth-Service OOM ===
    "Incident Incident-101 occurred at 2026-06-15T08:00:00Z and was resolved at 2026-06-15T09:30:00Z. The Auth-Service experienced an OutOfMemoryError OOM failure mode which caused auth failures. The root cause was an unclosed HTTP client session pool in Auth-Service version 1.2. The mitigation applied was running python3 scripts/restart_service.py auth-service which had a 1.0 efficacy rating.",

    # === Incident 102: Payment-Gateway High Latency ===
    "Incident Incident-102 occurred at 2026-06-20T14:00:00Z and was resolved at 2026-06-20T14:45:00Z. The Payment-Gateway experienced High Latency and checkout failures. This was caused by a ConnectionTimeout failure mode on Billing-DB. The root cause was connection leak due to slow queries on Billing-DB. SRE resolved the issue by executing the mitigation command python3 scripts/flush_pools.py billing-db which cleared idle connections and had a 1.0 efficacy rating.",

    # === Incident 201: Cascaded Payment Failure ===
    "Incident Incident-201 occurred at 2026-06-22T10:05:00Z and was resolved at 2026-06-22T10:20:00Z. Payment-Gateway experienced High Latency and was affected. SRE engineer Sarah on-call rotation Checkout-Team responded. The failure was caused by a ConnectionTimeout failure mode on Billing-DB, which resolves via Runbook Flush-DB-Pools-Guide. Sarah applied mitigation command python3 scripts/flush_pools.py billing-db with 1.0 efficacy. The incident triggered alert CPU-Threshold on Billing-DB.",

    # === ADR-402: Regional DB Migration ===
    "Architectural Decision ADR-402: We accept migrating Payment-Gateway dependencies to regional replicated Billing-DB clusters to reduce latency cascades. Rationale: Current single-instance DB connection pool timeouts trigger cascade outages. Decision status is accepted, date is 2026-06-23. This decision was informed by Incident Incident-201.",

    # === Incident 301: Search-Service DNS Failure ===
    "Incident Incident-301 occurred at 2026-06-10T11:00:00Z and was resolved at 2026-06-10T11:30:00Z. Search-Service experienced DNSResolutionFailure causing search queries to fail. Search-Service is a P1 service owned by the Search team with 99.9 SLO. Root cause was upstream DNS provider configuration change. SRE engineer Mike applied mitigation python3 scripts/restart_service.py search-service which flushed DNS cache. Efficacy: 0.8. Further mitigation required updating DNS config.",

    # === Incident 302: Notification-Queue Backlog ===
    "Incident Incident-302 occurred at 2026-06-12T15:00:00Z and was resolved at 2026-06-12T16:15:00Z. Notification-Service experienced QueueBacklog failure mode causing delayed email and SMS delivery. Notification-Service is a P2 service owned by the Engagement team. Root cause was a consumer process crash in the message queue. SRE engineer Priya scaled up consumer workers and ran python3 scripts/restart_service.py notification-service. Efficacy: 1.0.",

    # === Incident 303: CDN Cache Poisoning ===
    "Incident Incident-303 occurred at 2026-06-14T09:30:00Z and was resolved at 2026-06-14T11:00:00Z. CDN-Edge experienced CachePoisoning failure mode causing stale content delivery. CDN-Edge is a P0 service owned by the Infrastructure team. Root cause was misconfigured cache-control headers from a deployment. SRE engineer Alex flushed CDN cache and rolled back the deployment. Mitigation command: echo 'CDN cache purged'. Efficacy: 1.0.",

    # === ADR-401: Circuit Breaker Implementation ===
    "Architectural Decision ADR-401: Implement circuit breaker pattern for all Payment-Gateway downstream calls to Auth-Service and Billing-DB. Rationale: Incident-102 demonstrated that a single DB connection pool exhaustion can cascade into Payment-Gateway failures. Circuit breaker will open after 5 consecutive timeouts, preventing cascading failures. Status is accepted, date is 2026-06-18. This decision was informed by Incident Incident-102.",

    # === Incident 401: Data-Sync Race Condition ===
    "Incident Incident-401 occurred at 2026-06-18T13:00:00Z and was resolved at 2026-06-18T14:30:00Z. Data-Sync-Service experienced RaceCondition failure mode causing duplicate record creation. Data-Sync-Service is a P1 service owned by the Data-Platform team. Root cause was missing idempotency key in the sync API. SRE engineer Jordan applied hotfix and ran python3 scripts/restart_service.py data-sync-service. Efficacy: 0.9.",

    # === Incident 402: ML-Inference GPU OOM ===
    "Incident Incident-402 occurred at 2026-06-19T07:45:00Z and was resolved at 2026-06-19T08:30:00Z. ML-Inference-Service experienced GPUOutOfMemory failure mode causing recommendation failures. ML-Inference-Service is a P2 service owned by the ML-Platform team. Root cause was a memory leak in the model inference loop. SRE engineer Kim rolled back to previous model version and restarted with python3 scripts/restart_service.py ml-inference-service. Efficacy: 1.0.",

    # === ADR-403: GraphQL Federation Migration ===
    "Architectural Decision ADR-403: Migrate Payment-Gateway from REST to GraphQL federation to reduce N+1 query problems on checkout flows. Rationale: Checkout flows currently make 12 sequential API calls. GraphQL federation would reduce this to 2 round trips. Status is proposed, date is 2026-06-20. This decision was informed by performance data from Incidents 102 and 201.",

    # === Incident 501: Rate-Limiter False Positive ===
    "Incident Incident-501 occurred at 2026-06-25T16:00:00Z and was resolved at 2026-06-25T16:45:00Z. API-Gateway experienced RateLimiterFalsePositive failure mode causing legitimate traffic to be blocked. API-Gateway is a P0 service owned by the Infrastructure team. Root cause was a misconfigured rate limit threshold after a deployment. SRE engineer Taylor adjusted threshold and restarted with python3 scripts/restart_service.py api-gateway. Efficacy: 1.0.",

    # === Incident 502: Certificate Expiry ===
    "Incident Incident-502 occurred at 2026-06-26T03:00:00Z and was resolved at 2026-06-26T04:00:00Z. TLS termination on LoadBalancer experienced CertificateExpiry failure mode causing HTTPS handshake failures. LoadBalancer is a P0 component owned by the Infrastructure team. Root cause was missing certificate renewal automation. SRE engineer Casey manually renewed the certificate and updated the renewal cron job. Efficacy: 1.0.",

    # === Incident 503: Elasticsearch Cluster Split-Brain ===
    "Incident Incident-503 occurred at 2026-06-27T22:00:00Z and was resolved at 2026-06-28T01:00:00Z. Logging-Service experienced ElasticsearchSplitBrain failure mode causing log ingestion failures. Logging-Service is a P1 service owned by the Observability team. Root cause was network partition between ES nodes during a rack maintenance. SRE engineer Sam reconnected the nodes and ran python3 scripts/restart_service.py logging-service. Efficacy: 0.9.",

    # === Incident 504: Redis Cluster Failover ===
    "Incident Incident-504 occurred at 2026-06-28T14:30:00Z and was resolved at 2026-06-28T15:00:00Z. Session-Cache experienced RedisFailover failure mode causing session data loss for active users. Session-Cache is a P0 service owned by the Infrastructure team. Root cause was a primary node crash due to memory pressure. Redis sentinel promoted a replica automatically. SRE engineer Jordan verified data integrity and confirmed auto-recovery. No manual mitigation needed beyond monitoring.",

    # === ADR-404: Redis Cluster Architecture ===
    "Architectural Decision ADR-404: Migrate from single-instance Redis to Redis Cluster with 3 primary and 3 replica nodes. Rationale: Incident-504 demonstrated that single-instance Redis is a single point of failure for session data. Redis Cluster provides automatic failover and better memory distribution. Status is accepted, date is 2026-06-29. This decision was informed by Incident Incident-504.",

    # === Incident 601: Kafka Consumer Lag ===
    "Incident Incident-601 occurred at 2026-07-01T11:00:00Z and was resolved at 2026-07-01T12:30:00Z. Event-Stream-Service experienced KafkaConsumerLag failure mode causing real-time event processing delays. Event-Stream-Service is a P1 service owned by the Data-Platform team. Root cause was a consumer group rebalance triggered by a new deployment. SRE engineer Priya increased partition count and restarted consumers. Efficacy: 0.8.",

    # === Incident 602: S3 Bucket Policy Misconfiguration ===
    "Incident Incident-602 occurred at 2026-07-02T09:15:00Z and was resolved at 2026-07-02T10:00:00Z. Data-Lake-Service experienced S3AccessDenied failure mode causing data pipeline failures. Data-Lake-Service is a P1 service owned by the Data-Platform team. Root cause was an IAM policy change that accidentally removed S3 read access. SRE engineer Kim corrected the IAM policy and re-ran the failed pipeline. Efficacy: 1.0.",

    # === Incident 603: gRPC Connection Limit ===
    "Incident Incident-603 occurred at 2026-07-03T18:00:00Z and was resolved at 2026-07-03T18:45:00Z. User-Service experienced gRPCConnectionLimit failure mode causing user profile load failures. User-Service is a P1 service owned by the Identity team. Root cause was a connection pool set too low for peak traffic. SRE engineer Mike increased max_connections from 50 to 200 and restarted with python3 scripts/restart_service.py user-service. Efficacy: 1.0.",

    # === ADR-405: gRPC Connection Pool Sizing ===
    "Architectural Decision ADR-405: Implement dynamic gRPC connection pool sizing based on request volume. Rationale: Incident-603 showed that static connection pool sizing causes failures during traffic spikes. Dynamic sizing based on rolling average of request rate will prevent future incidents. Status is proposed, date is 2026-07-04. This decision was informed by Incident Incident-603.",

    # === Incident 701: Helm Chart Deployment Failure ===
    "Incident Incident-701 occurred at 2026-07-05T14:00:00Z and was resolved at 2026-07-05T15:30:00Z. CI-CD-Pipeline experienced HelmDeploymentFailure failure mode causing rollout failure to staging. CI-CD-Pipeline is a P2 service owned by the Platform-Engineering team. Root cause was an invalid values.yaml file committed without validation. SRE engineer Taylor fixed the values file and re-ran the pipeline. Efficacy: 1.0.",

    # === Incident 702: Terraform State Lock ===
    "Incident Incident-702 occurred at 2026-07-06T10:30:00Z and was resolved at 2026-07-06T11:00:00Z. IaC-Pipeline experienced TerraformStateLock failure mode causing infrastructure changes to be blocked. IaC-Pipeline is a P2 service owned by the Platform-Engineering team. Root cause was a stale lock file from a previously interrupted plan. SRE engineer Casey force-unlocked the state file and re-ran the pipeline. Efficacy: 1.0.",

    # === Incident 801: DDoS on Payment Gateway ===
    "Incident Incident-801 occurred at 2026-07-08T20:00:00Z and was resolved at 2026-07-09T02:00:00Z. Payment-Gateway experienced DDoSVolumeAttack failure mode causing checkout failures. Payment-Gateway is a P0 service owned by the Checkout team. Root cause was a coordinated botnet targeting the checkout endpoint. SRE engineer Sarah activated Cloudflare DDoS mitigation, implemented rate limiting at the edge, and scaled up Payment-Gateway pods. Efficacy: 1.0.",
]

async def main():
    print("Starting comprehensive sample data ingestion...")
    for idx, report in enumerate(incident_reports):
        print(f"Ingesting report {idx + 1}/{len(incident_reports)}...")
        await add_incident_report(text=report, dataset_name="incidents")
    print(f"All {len(incident_reports)} sample reports ingested successfully!")

if __name__ == "__main__":
    asyncio.run(main())
