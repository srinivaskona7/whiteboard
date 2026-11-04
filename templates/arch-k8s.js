// templates/arch-k8s.js — Kubernetes and container-internals teaching architectures.
// Authority: Kubernetes component and object relationships as documented upstream
// (pod lifecycle, control plane loops, service types, CSI, NetworkPolicy, HPA,
// operators, Istio, Argo Rollouts, chaos engineering) for the 2026-11 pack.
// Every diagram is plain stencil + arrow elements, not an image; parity with the
// AWS/Azure/GCP packs: ten diagrams, real teaching notes on each frame.
import { createElement } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';

const NODE_W = 164;
const NODE_H = 92;

const N = (stencilId, x, y, text, extra = {}) =>
  createElement('stencil', { stencilId, x, y, w: NODE_W, h: NODE_H, text, ...extra });

const A = (a, ap, b, bp, opts = {}) => {
  const arrow = createElement('arrow', { routing: 'orthogonal', endArrow: 'arrow', ...opts });
  bindConnectorEndpoint(arrow, 'start', a, ap);
  bindConnectorEndpoint(arrow, 'end', b, bp);
  return arrow;
};

const TITLE = (x, y, text) => createElement('text', { x, y, text, fontSize: 20, bold: true, w: 620, h: 30 });
const NOTE = (x, y, text) => createElement('text', { x, y, text, fontSize: 14, w: 640, h: 46, fill: '#475569' });

const diagram = (spec) => ({
  id: spec.id,
  name: spec.name,
  description: spec.description,
  category: 'multicloud',
  provider: 'Kubernetes',
  build() {
    const nodes = spec.build();
    const frame = createElement('frame', {
      x: 24,
      y: 48,
      w: spec.w || 1080,
      h: spec.h || 600,
      text: spec.frameTitle,
      teacherNotes: spec.teaching,
      slideOrder: 1,
    });
    for (const el of [frame, ...nodes]) el.templateId = spec.id;
    return [frame, ...nodes];
  },
});

export const ARCH_K8S_TEMPLATES = [
  diagram({
    id: 'tpl-k8s-pod-lifecycle',
    name: 'K8S-01 Pod lifecycle and restart policy',
    description: 'Pending → ContainerCreating → Running → probes, with Succeeded and CrashLoopBackOff branches governed by restartPolicy',
    frameTitle: 'Lesson: pod lifecycle and restart policy',
    teaching:
      'A pod is not "running" until the kubelet says so: it is Pending while the image pulls, ContainerCreating while the sandbox starts, then Running only when startup and readiness probes pass. CrashLoopBackOff is not a bug in the platform — it is the kubelet backing off exponentially (10s to 5m) while it applies restartPolicy to a container that keeps exiting.',
    build() {
      const pending = N('k8s-pod', 40, 130, 'web-pod (Pending)');
      const creating = N('k8s-pod', 250, 130, 'web-pod (ContainerCreating)');
      const running = N('k8s-pod', 460, 130, 'web-pod (Running, ready)');
      const probe = N('flow-decision', 670, 130, 'probe passes? exit code?');
      const done = N('k8s-job', 880, 130, 'Succeeded (Job: exit 0)');
      const crash = N('flow-process', 670, 300, 'CrashLoopBackOff');
      const pullErr = N('flow-process', 250, 300, 'ImagePullBackOff');
      const kubelet = N('k8s-node', 460, 300, 'kubelet + container runtime');
      return [
        TITLE(40, 76, 'From Pending to Running — and what happens when it will not stay there'),
        pending,
        creating,
        running,
        probe,
        done,
        crash,
        pullErr,
        kubelet,
        A(pending, 'right', creating, 'left', { text: 'scheduler binds pod to node' }),
        A(creating, 'right', running, 'left', { text: 'sandbox + image started' }),
        A(running, 'right', probe, 'left', { text: 'liveness / readiness probe' }),
        A(probe, 'right', done, 'left', { text: 'exit 0 → Completed' }),
        A(probe, 'bottom', crash, 'top', { text: 'exit 1 → restart' }),
        A(creating, 'bottom', pullErr, 'top', { text: 'registry auth / tag wrong' }),
        A(crash, 'left', kubelet, 'right', { text: 'back-off 10s … 5m' }),
        A(kubelet, 'top', running, 'bottom', { text: 'restartPolicy: Always recreates' }),
        NOTE(40, 560, 'restartPolicy is the contract: Always for servers, OnFailure for jobs, Never for DaemonSet-managed debugging. CrashLoopBackOff means look at logs of the previous container, not the current one.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-control-plane',
    name: 'K8S-02 Control plane reconciliation loop',
    description: 'kubectl/CI → kube-apiserver ↔ etcd ↔ scheduler ↔ controller-manager ↔ kubelet, one reconciliation loop around a single source of truth',
    frameTitle: 'Lesson: the control plane reconciliation loop',
    teaching:
      'Everything flows through the API server, and only the API server touches etcd — components never talk to each other directly. Each controller watches desired state in etcd, compares it with observed state, and writes back a correction. That watch-and-correct loop, not a script, is what keeps the cluster converging on the manifest you applied.',
    build() {
      const kubectl = N('net-user', 40, 130, 'kubectl / CI pipeline');
      const api = N('k8s-apiserver', 250, 130, 'kube-apiserver');
      const etcd = N('k8s-etcd', 460, 130, 'etcd (single source of truth)');
      const sched = N('flow-process', 670, 130, 'kube-scheduler');
      const cm = N('flow-process', 880, 130, 'controller-manager');
      const kubelet = N('k8s-node', 880, 300, 'kubelet (node agent)');
      const pod = N('k8s-pod', 670, 300, 'pod scheduled onto node');
      const lb = N('k8s-svc', 460, 300, 'endpoints updated by svc controller');
      return [
        TITLE(40, 76, 'One API, one truth, many reconciling controllers'),
        kubectl,
        api,
        etcd,
        sched,
        cm,
        kubelet,
        pod,
        lb,
        A(kubectl, 'right', api, 'left', { text: 'apply / watch (REST)' }),
        A(api, 'right', etcd, 'left', { text: 'read / write (only via apiserver)' }),
        A(etcd, 'right', sched, 'left', { text: 'watch: unassigned pods' }),
        A(sched, 'right', cm, 'left', { text: 'bind → node elected' }),
        A(cm, 'bottom', kubelet, 'top', { text: 'watch deployments / replicasets' }),
        A(kubelet, 'left', pod, 'right', { text: 'starts containers, reports status' }),
        A(pod, 'left', lb, 'right', { text: 'pod IP joins endpoints' }),
        A(lb, 'left', api, 'bottom', { text: 'status write-back', routing: 'curved' }),
        NOTE(40, 560, 'The scheduler only assigns nodes; the kubelet only runs what it is told; controllers only close the gap between spec and status. Remove any one and the loop still reports — it just stops converging.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-service-routing',
    name: 'K8S-03 Service types and traffic routing',
    description: 'LoadBalancer → NodePort → ClusterIP → pod endpoints via kube-proxy, plus ExternalName as a DNS-only exception',
    frameTitle: 'Lesson: how a Service actually reaches a pod',
    teaching:
      'The four Service types are layered, not alternatives: a LoadBalancer is a cloud LB in front of a NodePort, which is in front of a ClusterIP, which kube-proxy turns into endpoint rules. ExternalName breaks the pattern — it is only a DNS CNAME, no proxying at all, which is why it can never load-balance.',
    build() {
      const client = N('net-user', 40, 130, 'external client');
      const lbsvc = N('k8s-svc', 250, 130, 'Service: LoadBalancer');
      const npsvc = N('k8s-svc', 460, 130, 'Service: NodePort :30080');
      const cip = N('k8s-svc', 670, 130, 'Service: ClusterIP 10.0.4.5:80');
      const podA = N('k8s-pod', 460, 300, 'pod :8080 (ready endpoint)');
      const podB = N('k8s-pod', 670, 300, 'pod :8080 (ready endpoint)');
      const ext = N('flow-data', 880, 130, 'ExternalName → db.example.com');
      const kp = N('flow-process', 250, 300, 'kube-proxy endpoint rules');
      return [
        TITLE(40, 76, 'Four Service types, one endpoint list'),
        client,
        lbsvc,
        npsvc,
        cip,
        podA,
        podB,
        ext,
        kp,
        A(client, 'right', lbsvc, 'left', { text: 'traffic to cloud LB :443' }),
        A(lbsvc, 'right', npsvc, 'left', { text: 'nodeIP:30080' }),
        A(npsvc, 'right', cip, 'left', { text: 'clusterIP :80' }),
        A(cip, 'bottom', podB, 'top', { text: 'endpointslice lookup' }),
        A(podB, 'left', podA, 'right', { text: 'load-balanced across ready pods' }),
        A(cip, 'bottom', kp, 'right', { text: 'ipvs / iptables rules', routing: 'curved' }),
        A(client, 'bottom', ext, 'left', { text: 'CNAME only — never proxied', routing: 'curved' }),
        NOTE(40, 560, 'A pod only receives traffic when it is Ready. kube-proxy programs the rules; the endpoints controller decides membership. ExternalName has no selectors and no rules — it is DNS, nothing more.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-istio-mesh',
    name: 'K8S-04 Istio service mesh traffic path',
    description: 'istio-ingressgateway → VirtualService routing → sidecar envoys with mTLS, plus the egress gateway for external calls',
    frameTitle: 'Lesson: service mesh traffic and mTLS',
    teaching:
      'In a mesh the application never dials another service: the sidecar envoy does, so retries, timeouts and mTLS become platform features instead of library code. VirtualService decides WHERE traffic goes and how it splits; mTLS comes from SPIFFE identities the mesh issues, so the connection is trusted without the app knowing a certificate exists.',
    build() {
      const client = N('net-user', 40, 130, 'client');
      const igw = N('net-envoy', 250, 130, 'istio-ingressgateway');
      const vs = N('k8s-mesh', 460, 130, 'VirtualService + DestinationRule');
      const mtls = N('concept-tls', 670, 130, 'mTLS: SPIFFE identities');
      const podA = N('k8s-pod', 460, 300, 'reviews-v1 pod + envoy sidecar');
      const podB = N('k8s-pod', 670, 300, 'reviews-v2 pod (10% canary)');
      const egress = N('net-envoy', 880, 300, 'egress gateway');
      return [
        TITLE(40, 76, 'Route rules and encryption the app never codes'),
        client,
        igw,
        vs,
        mtls,
        podA,
        podB,
        egress,
        A(client, 'right', igw, 'left', { text: 'HTTPS :443 (Gateway + hosts)' }),
        A(igw, 'right', vs, 'left', { text: 'match host + headers' }),
        A(vs, 'bottom', podA, 'top', { text: '90% → v1 (subset)' }),
        A(vs, 'bottom', podB, 'top', { text: '10% → v2 canary', routing: 'curved' }),
        A(podA, 'right', podB, 'left', { text: 'envoy-to-envoy mTLS' }),
        A(mtls, 'bottom', podB, 'top', { text: 'SVID cert rotation', routing: 'curved' }),
        A(podB, 'right', egress, 'left', { text: 'external call, still observed' }),
        NOTE(40, 560, 'The sidecar is a transparent proxy: application sees plain HTTP, the mesh sees mTLS. AuthorizationPolicy can allow reviews → ratings and silently deny everything else at L7.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-operator-pattern',
    name: 'K8S-05 Operator / CRD reconcile pattern',
    description: 'Custom Resource → CRD schema at the API server → controller reconcile loop → child workload plus status and generated secrets',
    frameTitle: 'Lesson: extending the API with an operator',
    teaching:
      'An operator teaches the control plane a new noun and verb: the CRD publishes the schema, the CR is an instance, and the controller runs the same watch-compare-correct loop as the built-in controllers — only its "compare" is your domain logic. Status subresource writes make the CR self-describing, so `kubectl get` shows what the controller actually achieved.',
    build() {
      const cr = N('flow-data', 40, 130, 'CR: DatabaseCluster (spec: size 3)');
      const api = N('k8s-apiserver', 250, 130, 'kube-apiserver + CRD schema');
      const ctrl = N('flow-process', 460, 130, 'custom controller (reconcile)');
      const decide = N('flow-decision', 670, 130, 'observed == desired?');
      const workload = N('k8s-deploy', 880, 130, 'child Deployment (StatefulSet)');
      const secret = N('k8s-secret', 670, 300, 'generated connection Secret');
      const status = N('flow-data', 460, 300, 'status: conditions + endpoint');
      return [
        TITLE(40, 76, 'A controller for your own resource kind'),
        cr,
        api,
        ctrl,
        decide,
        workload,
        secret,
        status,
        A(cr, 'right', api, 'left', { text: 'kubectl apply (validated by CRD)' }),
        A(api, 'right', ctrl, 'left', { text: 'watch event via informer cache' }),
        A(ctrl, 'right', decide, 'left', { text: 'observe children' }),
        A(decide, 'right', workload, 'left', { text: 'no → create / scale children' }),
        A(decide, 'bottom', secret, 'top', { text: 'yes → own and re-label secrets' }),
        A(workload, 'bottom', secret, 'right', { text: 'mounts generated credential', routing: 'curved' }),
        A(status, 'top', ctrl, 'bottom', { text: 'reconcile writes status back' }),
        A(status, 'right', secret, 'left', { text: 'generation vs observedGeneration' }),
        NOTE(40, 560, 'Level-based, not trigger-based: every event may be missed, so the controller re-reads the world instead of remembering what it did. OwnerReferences let garbage collection clean up when the CR is deleted.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-hpa-scaling',
    name: 'K8S-06 Horizontal Pod Autoscaler loop',
    description: 'metrics-server and prometheus-adapter feed the HPA, which scales the Deployment through the scale subresource',
    frameTitle: 'Lesson: the HPA metrics control loop',
    teaching:
      'The HPA is another reconciler: every 15 seconds it queries metrics, compares usage to the target (avgCPU 50% or a custom metric), and writes replicas through the scale subresource — it never touches pods itself. Without metrics-server running the loop silently stays at minimum replicas, which is the single most common "why did it not scale" question.',
    build() {
      const deploy = N('k8s-deploy', 40, 130, 'Deployment: api (replicas 2)');
      const hpa = N('k8s-hpa', 250, 130, 'HPA: min 2 / max 10');
      const ms = N('flow-process', 460, 130, 'metrics-server (metrics.k8s.io)');
      const prom = N('obs-prometheus', 670, 130, 'prometheus-adapter (custom)');
      const api = N('k8s-apiserver', 250, 300, 'apiserver /scale subresource');
      const podA = N('k8s-pod', 460, 300, 'replica pod (CPU 88%)');
      const podB = N('k8s-pod', 670, 300, 'new replica pod (scheduled)');
      return [
        TITLE(40, 76, 'Target, measure, scale — every fifteen seconds'),
        deploy,
        hpa,
        ms,
        prom,
        api,
        podA,
        podB,
        A(podA, 'top', ms, 'bottom', { text: 'kubelet summary scrape', routing: 'curved' }),
        A(hpa, 'right', ms, 'left', { text: 'query pod CPU vs target' }),
        A(hpa, 'right', prom, 'left', { text: 'custom metric: queue_depth', routing: 'curved' }),
        A(prom, 'bottom', podB, 'top', { text: 'scrape /metrics endpoints' }),
        A(hpa, 'bottom', api, 'top', { text: 'scale to replicas 4' }),
        A(api, 'left', deploy, 'bottom', { text: 'update spec.replicas' }),
        A(deploy, 'bottom', podA, 'left', { text: 'ReplicaSet creates pods', routing: 'curved' }),
        NOTE(40, 560, 'Scale up is fast, scale-down is deliberately slow (default 5 minutes of stability) to stop flapping. Set requests correctly first — HPA percentages are meaningless against an unset request.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-storage-csi',
    name: 'K8S-07 Storage: PVC, PV and the CSI driver',
    description: 'PVC bound to a PV, dynamically provisioned by a CSI driver per StorageClass, mounted into the pod by the kubelet',
    frameTitle: 'Lesson: how a claim becomes a mounted disk',
    teaching:
      'The app asks for a size and an access mode (PVC), never for a device. The StorageClass names the CSI driver, the external-provisioner calls CreateVolume, and a PV appears and binds. The kubelet then does the mount through the CSI node plugin — which is why a wrong StorageClass is a fast-fail you see at Pending, but a broken driver shows up as a stuck ContainerCreating.',
    build() {
      const pod = N('k8s-pod', 40, 130, 'pod (volumeMount: /data)');
      const pvc = N('k8s-pvc', 250, 130, 'PVC: data 20Gi RWO');
      const pv = N('flow-process', 460, 130, 'PV: pvc-a1b2 (Bound)');
      const csi = N('flow-process', 670, 130, 'CSI driver: controller + provisioner');
      const sc = N('flow-data', 880, 130, 'StorageClass: fast-ssd (default)');
      const backend = N('concept-disk', 880, 300, 'cloud block volume');
      const kubelet = N('k8s-node', 250, 300, 'kubelet + CSI node plugin');
      return [
        TITLE(40, 76, 'Dynamic provisioning, top to bottom'),
        pod,
        pvc,
        pv,
        csi,
        sc,
        backend,
        kubelet,
        A(pod, 'right', pvc, 'left', { text: 'claim name in the pod spec' }),
        A(pvc, 'right', pv, 'left', { text: 'binds by size + access mode' }),
        A(pv, 'right', csi, 'left', { text: 'volumeHandle created' }),
        A(csi, 'right', sc, 'left', { text: 'provisioner + reclaimPolicy' }),
        A(csi, 'bottom', backend, 'top', { text: 'CreateVolume on the provider' }),
        A(kubelet, 'top', pvc, 'bottom', { text: 'mount at pod start (fsGroupMode)' }),
        A(backend, 'left', kubelet, 'bottom', { text: 'attach + format via node plugin', routing: 'curved' }),
        NOTE(40, 560, 'reclaimPolicy decides the ending: Delete cleans up with the PVC, Retain keeps the disk waiting for a manual decision — a PV with Retain survives its pod, its PVC and your attention span.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-network-policy',
    name: 'K8S-08 NetworkPolicy and default-deny',
    description: 'Namespace isolation: an allow rule for checkout → payments, a default-deny for everything else, enforced by the CNI',
    frameTitle: 'Lesson: namespaces do not isolate — policies do',
    teaching:
      'A namespace groups names; it blocks nothing. In a CNI that enforces NetworkPolicy, traffic is allowed only once a policy allows it — so the standard hardening pattern is a default-deny for ingress and egress, then explicit allow rules for each permitted flow. Policies are additive: two policies never conflict, and anything unmatched stays denied.',
    build() {
      const ns = N('bnd-k8s-ns', 40, 130, 'Namespace: payments (labels)');
      const web = N('k8s-pod', 250, 130, 'checkout pod (app: web)');
      const api = N('k8s-pod', 460, 130, 'payments pod (app: api)');
      const allow = N('sec-sg', 670, 130, 'Policy: allow web→api :8080');
      const deny = N('sec-sg', 880, 130, 'default-deny ingress+egress');
      const admin = N('k8s-pod', 250, 300, 'debug pod (no matching rule)');
      const check = N('flow-decision', 460, 300, 'conntrack: policy allows?');
      const cni = N('net-firewall', 670, 300, 'CNI: calico / cilium rules');
      return [
        TITLE(40, 76, 'Default deny, then allow exactly what you meant'),
        ns,
        web,
        api,
        allow,
        deny,
        admin,
        check,
        cni,
        A(ns, 'right', web, 'left', { text: 'namespaceSelector' }),
        A(web, 'right', api, 'left', { text: 'allowed by allow-rule (podSelector)' }),
        A(api, 'right', allow, 'left', { text: 'ports: 8080, from: app=web' }),
        A(allow, 'right', deny, 'left', { text: 'policies are additive' }),
        A(admin, 'right', check, 'left', { text: 'denied: no allow rule matches' }),
        A(check, 'right', cni, 'left', { text: 'enforced in iptables / eBPF' }),
        A(check, 'top', api, 'bottom', { text: 'per-connection verdict', routing: 'curved' }),
        NOTE(40, 560, 'Two policies cannot conflict — they merge allowances. If your CNI does not implement NetworkPolicy the manifest applies silently and blocks nothing, so verify enforcement, not the YAML.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-rollouts',
    name: 'K8S-09 Argo Rollouts canary analysis',
    description: 'Rollout CR drives stable and canary ReplicaSets, metric analysis promotes or aborts, traffic is shifted by weight at the service',
    frameTitle: 'Lesson: progressive delivery with analysis gates',
    teaching:
      'A Rollout replaces the Deployment with a traffic-shifting state machine: it scales a canary ReplicaSet in steps and only promotes when the AnalysisTemplate says the metrics are healthy, aborting automatically back to stable when they are not. The service never changes — the weights do, which is what makes a rollback instant and reversible.',
    build() {
      const user = N('net-user', 40, 130, 'user traffic');
      const svc = N('k8s-svc', 250, 130, 'Service (stable + canary selector)');
      const stable = N('k8s-deploy', 250, 300, 'stable ReplicaSet v1 (90%)');
      const canary = N('k8s-deploy', 460, 300, 'canary ReplicaSet v2 (10%)');
      const ro = N('cicd-argocd', 40, 300, 'Rollout CR (canary steps)');
      const metrics = N('obs-prometheus', 670, 300, 'AnalysisTemplate: error rate');
      const decide = N('flow-decision', 670, 130, 'analysis: within threshold?');
      const rollback = N('flow-process', 880, 300, 'abort → restore stable 100%');
      return [
        TITLE(40, 76, 'Ship 10% first; let the numbers promote it'),
        user,
        svc,
        stable,
        canary,
        ro,
        metrics,
        decide,
        rollback,
        A(user, 'right', svc, 'left', { text: 'requests' }),
        A(svc, 'bottom', stable, 'top', { text: '90% by canaryWeight' }),
        A(svc, 'bottom', canary, 'top', { text: '10% (mesh / ingress trafficRouting)', routing: 'curved' }),
        A(ro, 'right', canary, 'left', { text: 'setWeight 10 → pause → 100' }),
        A(canary, 'right', metrics, 'left', { text: 'success-rate query each interval' }),
        A(metrics, 'top', decide, 'bottom', { text: 'measurement vs threshold' }),
        A(decide, 'left', svc, 'bottom', { text: 'promote: scale v1 to 0', routing: 'curved' }),
        A(decide, 'bottom', rollback, 'top', { text: 'failed metric → abort' }),
        NOTE(40, 560, 'Every step is a gate: small blast radius, measured before the next step. Automatic abort is the point — a human watching a dashboard at 2 a.m. is not an analysis template.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-k8s-chaos',
    name: 'K8S-10 Chaos engineering experiment',
    description: 'Steady state → hypothesis → Chaos Mesh fault injection on a target pod, SLO metrics watched, halt criteria stop the experiment',
    frameTitle: 'Lesson: a chaos experiment is a controlled test',
    teaching:
      'Chaos engineering is not random destruction: you state a steady state, form a hypothesis that the system tolerates a fault, then inject the smallest fault that tests it while watching the SLO. Halt criteria — maximum blast radius and a metric floor — are defined before the experiment starts, so the experiment ends by design, not by pager.',
    build() {
      const steady = N('flow-terminator', 40, 130, 'steady state: p99 < 300ms');
      const hyp = N('flow-process', 250, 130, 'hypothesis: lose 1 pod, SLO holds');
      const chaos = N('flow-process', 460, 130, 'Chaos Mesh: PodChaos kill');
      const target = N('k8s-pod', 460, 300, 'target pod (fault injected)');
      const heal = N('k8s-deploy', 670, 300, 'ReplicaSet: 3 pods, self-heals');
      const slo = N('obs-prometheus', 670, 130, 'SLO metrics during blast');
      const halt = N('flow-decision', 880, 130, 'halt criteria met?');
      const stop = N('flow-terminator', 880, 300, 'halt: end + record learning');
      return [
        TITLE(40, 76, 'Steady state, fault, measurement — and a way out'),
        steady,
        hyp,
        chaos,
        target,
        heal,
        slo,
        halt,
        stop,
        A(steady, 'right', hyp, 'left', { text: 'define the measurable normal' }),
        A(hyp, 'right', chaos, 'left', { text: 'design the fault + blast radius' }),
        A(chaos, 'bottom', target, 'top', { text: 'kill -9, network delay, IO stress' }),
        A(target, 'right', heal, 'left', { text: 'scheduler replaces the pod' }),
        A(target, 'top', slo, 'bottom', { text: 'p99, error rate, saturation', routing: 'curved' }),
        A(slo, 'right', halt, 'left', { text: 'guard metric floor' }),
        A(halt, 'bottom', stop, 'top', { text: 'halt, revert, write it down' }),
        NOTE(40, 560, 'Run experiments in business hours with the team watching, never during an incident. The artifact that matters is the recorded learning — a hypothesis that survived tells you what you may actually rely on.'),
      ];
    },
  }),
];
