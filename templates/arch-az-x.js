// templates/arch-az-x.js — second Azure pack: ten teaching architectures for
// services the first Azure pack did not cover (media, FHIR, Front Door, APIM,
// batch ETL, AVD, Databricks, Sentinel, JAMStack, hub-spoke firewall).
// Parity with templates/aws.js: plain stencil + arrow elements, one teaching
// sentence per diagram, templateId stamped on every element.
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
  provider: 'Azure',
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

export const ARCH_AZ_X_TEMPLATES = [
  diagram({
    id: 'tpl-azx-media-encoding',
    name: 'AZX-01 Media encoding and delivery',
    description: 'Blob media upload → Media Services encoding jobs → Front Door CDN delivery with Event Grid job tracking',
    frameTitle: 'Lesson: media encoding pipeline on Azure',
    teaching:
      'The asset is uploaded once, encoded many times: Media Services turns one master file into an adaptive-bitrate set, and Front Door serves the encoded copy from the edge. Event Grid is what tells you a job finished — never poll for it.',
    build() {
      const viewer = N('cloud-generic', 40, 130, 'Viewers');
      const input = N('az-blob', 250, 130, 'Blob input asset');
      const encoder = N('flow-process', 460, 130, 'Media Services job');
      const transform = N('flow-process', 460, 300, 'Transform (ABR set)');
      const output = N('az-blob', 670, 300, 'Blob output asset');
      const cdn = N('az-frontdoor', 880, 300, 'Front Door + CDN');
      const grid = N('az-eventgrid', 670, 130, 'Event Grid');
      const monitor = N('az-monitor', 880, 130, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Upload once, encode in the cloud, deliver from the edge'),
        viewer,
        input,
        encoder,
        transform,
        output,
        cdn,
        grid,
        monitor,
        A(input, 'right', encoder, 'left', { text: 'upload master' }),
        A(encoder, 'bottom', transform, 'top', { text: 'submit job' }),
        A(transform, 'right', output, 'left', { text: 'write MP4 set' }),
        A(output, 'right', cdn, 'left', { text: 'streaming locator' }),
        A(encoder, 'right', grid, 'left', { text: 'job state change' }),
        A(grid, 'bottom', cdn, 'top', { text: 'purge edge cache', routing: 'curved' }),
        A(cdn, 'top', monitor, 'left', { text: 'delivery metrics', routing: 'curved' }),
        A(viewer, 'right', cdn, 'top', { text: 'playback (HLS)', routing: 'curved' }),
        NOTE(40, 560, 'Encoding is compute you rent by the minute; delivery is a cache you never patch. Keep the locator short-lived and revoke it when the licence for the asset expires.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-healthcare-fhir',
    name: 'AZX-02 Healthcare FHIR ingestion',
    description: 'Azure API for FHIR → Functions ingestion → Cosmos DB patient store, Event Grid audit trail, Entra ID auth',
    frameTitle: 'Lesson: healthcare records with FHIR',
    teaching:
      'FHIR is the contract, not the database: the API layer validates resources against FHIR profiles before anything is stored, so Cosmos DB only ever holds conformant data. Every write emits an Event Grid event, because in healthcare an unaudited change is a change that legally did not happen.',
    build() {
      const ehr = N('cloud-generic', 40, 130, 'Hospital EHR');
      const fhir = N('flow-process', 250, 130, 'Azure API for FHIR');
      const entra = N('az-entra', 250, 330, 'Entra ID (SMART on FHIR)');
      const fn = N('az-functions', 460, 130, 'Ingestion function');
      const store = N('az-cosmos', 670, 130, 'Cosmos DB patient store');
      const audit = N('az-eventgrid', 670, 330, 'Event Grid audit');
      const monitor = N('az-monitor', 880, 330, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Interoperable patient records via FHIR R4'),
        ehr,
        fhir,
        entra,
        fn,
        store,
        audit,
        monitor,
        A(ehr, 'right', fhir, 'left', { text: 'FHIR/REST' }),
        A(entra, 'top', fhir, 'bottom', { text: 'bearer token' }),
        A(fhir, 'right', fn, 'left', { text: 'validated bundle' }),
        A(fn, 'right', store, 'left', { text: 'partition by patient' }),
        A(store, 'bottom', audit, 'top', { text: 'create / update event' }),
        A(audit, 'right', monitor, 'left', { text: 'audit log sink' }),
        NOTE(40, 560, 'Partition Cosmos DB by patient id so one patient is always one logical record. Access is checked per-resource at the API, not by handing out the connection string.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-ecommerce-frontdoor',
    name: 'AZX-03 E-commerce edge and web tier',
    description: 'Front Door + WAF → App Gateway → App Service web + Functions catalogue API → Cosmos DB + Cache for Redis',
    frameTitle: 'Lesson: e-commerce front door',
    teaching:
      'Front Door answers at the anycast edge and its WAF drops the obvious attack before the request ever crosses the ocean. App Gateway then splits traffic: the browser gets the web app, catalogue calls go straight to the API — both reach data through one Redis cache, which is what keeps a sale from becoming a database outage.',
    build() {
      const user = N('cloud-generic', 40, 130, 'Shopper');
      const fd = N('az-frontdoor', 250, 130, 'Front Door + WAF');
      const gw = N('az-appgw', 460, 130, 'App Gateway (regional)');
      const web = N('az-appservice', 670, 130, 'App Service web');
      const api = N('az-functions', 670, 300, 'Functions catalogue API');
      const cache = N('az-redis', 460, 300, 'Cache for Redis');
      const db = N('az-cosmos', 250, 300, 'Cosmos DB catalogue');
      const monitor = N('az-monitor', 880, 300, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Global front door over a regional web tier'),
        user,
        fd,
        gw,
        web,
        api,
        cache,
        db,
        monitor,
        A(user, 'right', fd, 'left', { text: 'HTTPS' }),
        A(fd, 'right', gw, 'left', { text: 'clean request' }),
        A(gw, 'right', web, 'left', { text: 'path: /' }),
        A(gw, 'bottom', api, 'top', { text: 'path: /api', routing: 'curved' }),
        A(api, 'left', cache, 'right', { text: 'read-through cache' }),
        A(cache, 'left', db, 'right', { text: 'cache miss' }),
        A(api, 'right', monitor, 'left', { text: 'telemetry' }),
        NOTE(40, 560, 'Two caches matter here: the CDN at the edge for images, Redis in the region for catalogue reads. Neither should ever hold the price the shopper pays — that stays transactional.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-apim-microservices',
    name: 'AZX-04 APIM-managed microservices',
    description: 'APIM policies → Container Apps services → Service Bus queue → Functions workers, with App Insights tracing',
    frameTitle: 'Lesson: API management in front of containers',
    teaching:
      'APIM is where the contract lives: it validates keys, applies rate limits and rewrites versions so clients never see a container redeploy. Behind it, Container Apps scale per-revision and hand slow work to Service Bus, which is what absorbs a burst instead of letting it crash a worker.',
    build() {
      const client = N('cloud-generic', 40, 130, 'Partner client');
      const apim = N('az-apim', 250, 130, 'APIM (policies + keys)');
      const svcA = N('az-containerapps', 460, 130, 'Orders service');
      const svcB = N('az-containerapps', 460, 330, 'Stocks service');
      const bus = N('az-servicebus', 670, 130, 'Service Bus queue');
      const worker = N('az-functions', 880, 130, 'Functions worker');
      const insights = N('az-appinsights', 670, 330, 'App Insights');
      const monitor = N('az-monitor', 880, 330, 'Azure Monitor');
      return [
        TITLE(40, 76, 'One front door policy for many small services'),
        client,
        apim,
        svcA,
        svcB,
        bus,
        worker,
        insights,
        monitor,
        A(client, 'right', apim, 'left', { text: 'subscription key' }),
        A(apim, 'right', svcA, 'left', { text: 'rate-limited' }),
        A(apim, 'bottom', svcB, 'top', { text: 'route /stock', routing: 'curved' }),
        A(svcA, 'right', bus, 'left', { text: 'enqueue order' }),
        A(bus, 'right', worker, 'left', { text: 'peek-lock' }),
        A(svcA, 'bottom', insights, 'top', { text: 'correlated traces', routing: 'curved' }),
        A(insights, 'right', monitor, 'left', { text: 'alerts' }),
        NOTE(40, 560, 'A queue between the API and the worker is what keeps a p99 promise: the caller gets a 202 in milliseconds while the heavy work happens out-of-band with retries.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-batch-etl',
    name: 'AZX-05 Batch ETL to a warehouse',
    description: 'Blob landing zone → Data Factory pipeline → Synapse SQL pool → Power BI, orchestrated nightly',
    frameTitle: 'Lesson: nightly batch ETL',
    teaching:
      'Data Factory is the orchestrator, not the engine: it copies raw files into the lake, then hands transformation to the pool that can actually parallelise it. The landing zone keeps raw data immutable — if a transform is wrong you reload from raw, you never ask a source system twice.',
    build() {
      const source = N('cloud-generic', 40, 130, 'Source systems');
      const land = N('az-blob', 250, 130, 'Blob landing zone');
      const adf = N('flow-process', 460, 130, 'Data Factory pipeline');
      const stage = N('flow-data', 460, 330, 'Staging tables');
      const pool = N('az-synapse', 670, 330, 'Synapse SQL pool');
      const bi = N('flow-process', 880, 330, 'Power BI dataset');
      const monitor = N('az-monitor', 670, 130, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Files to a modelled warehouse, once per night'),
        source,
        land,
        adf,
        stage,
        pool,
        bi,
        monitor,
        A(source, 'right', land, 'left', { text: 'nightly export' }),
        A(land, 'right', adf, 'left', { text: 'copy activity' }),
        A(adf, 'bottom', stage, 'top', { text: 'load raw' }),
        A(stage, 'right', pool, 'left', { text: 'transform (CTAS)' }),
        A(pool, 'right', bi, 'left', { text: 'import mode' }),
        A(adf, 'right', monitor, 'left', { text: 'run metrics' }),
        NOTE(40, 560, 'Each activity in the pipeline should be idempotent: a rerun after a 3am failure must produce the same tables, not duplicates. Pause the pool after the load or the nightly job pays for idle hours.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-virtual-desktop',
    name: 'AZX-06 Azure Virtual Desktop',
    description: 'AVD client → host pool VMs with FSLogix profiles on Blob, Monitor diagnostics, Entra ID auth',
    frameTitle: 'Lesson: virtual desktops as a fleet',
    teaching:
      'The VM is disposable and the profile is not: FSLogix keeps the user profile on Blob storage, so a session host can be replaced and the user signs back in as if nothing happened. Depth-first load balancing fills one host before waking the next, which is how a pooled fleet stays affordable.',
    build() {
      const device = N('cloud-generic', 40, 130, 'Thin client');
      const gateway = N('flow-process', 250, 130, 'AVD gateway + broker');
      const entra = N('az-entra', 40, 330, 'Entra ID auth');
      const pool = N('az-vm', 460, 130, 'Host pool (session hosts)');
      const profiles = N('az-blob', 670, 130, 'Blob FSLogix profiles');
      const monitor = N('az-monitor', 670, 330, 'Azure Monitor');
      const net = N('az-vnet', 460, 330, 'VNet (pooled subnet)');
      return [
        TITLE(40, 76, 'A desktop that is really a fleet of profiles'),
        device,
        gateway,
        entra,
        pool,
        profiles,
        monitor,
        net,
        A(device, 'right', gateway, 'left', { text: 'reverse connect' }),
        A(entra, 'right', net, 'left', { text: 'conditional access' }),
        A(gateway, 'right', pool, 'left', { text: 'broker session' }),
        A(pool, 'right', profiles, 'left', { text: 'mount profile VHDX' }),
        A(pool, 'bottom', net, 'top', { text: 'session traffic' }),
        A(net, 'right', monitor, 'left', { text: 'host diagnostics' }),
        NOTE(40, 560, 'Never give users admin on a pooled host. Ship apps per-user via MSIX or assign them to personal host pools — a polluted image is the most common cause of a slow sign-in.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-databricks-analytics',
    name: 'AZX-07 Databricks streaming analytics',
    description: 'Event Hubs ingestion → Databricks clusters → Blob lake (delta) → Synapse serving layer',
    frameTitle: 'Lesson: stream to lake to serving layer',
    teaching:
      'Event Hubs keeps the order of events even under burst, and the cluster writes Delta tables so a reprocessed batch replaces a partition instead of duplicating rows. Analysts never query the raw lake directly — Synapse serves the modelled views, which is what keeps ad-hoc SQL from fighting the streaming job.',
    build() {
      const apps = N('cloud-generic', 40, 130, 'App telemetry');
      const hubs = N('az-eventhubs', 250, 130, 'Event Hubs (stream)');
      const cluster = N('flow-process', 460, 130, 'Databricks cluster');
      const etl = N('flow-process', 460, 330, 'Structured streaming job');
      const lake = N('az-blob', 670, 130, 'Blob lake (Delta)');
      const serve = N('az-synapse', 670, 330, 'Synapse serving pool');
      const monitor = N('az-monitor', 880, 130, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Events become tables without a nightly batch'),
        apps,
        hubs,
        cluster,
        etl,
        lake,
        serve,
        monitor,
        A(apps, 'right', hubs, 'left', { text: 'produce events' }),
        A(hubs, 'right', cluster, 'left', { text: 'consume (checkpoint)' }),
        A(cluster, 'bottom', etl, 'top', { text: 'spark jobs' }),
        A(etl, 'right', serve, 'left', { text: 'silver/gold views' }),
        A(cluster, 'right', lake, 'left', { text: 'write Delta' }),
        A(lake, 'right', monitor, 'left', { text: 'lake metrics' }),
        NOTE(40, 560, 'Checkpointing the consumer is the whole trick of exactly-once: restart the job and it resumes at the offset. Autoscale the cluster, or a quiet night still costs a cluster.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-soc-sentinel',
    name: 'AZX-08 SOC with Sentinel',
    description: 'Event Hubs / Event Grid telemetry → Sentinel correlation rules → Logic Apps playbooks → SOC response',
    frameTitle: 'Lesson: a SOC that answers automatically',
    teaching:
      'Sentinel is the place where logs become incidents: every source lands in one workspace, analytics rules correlate across them, and a Logic App playbook contains the response. Automation is for the boring first five minutes — disable the account, isolate the host — while the analyst decides what it means.',
    build() {
      const sources = N('cloud-generic', 40, 130, 'VMs, apps, IdP logs');
      const hubs = N('az-eventhubs', 250, 130, 'Event Hubs collector');
      const grid = N('az-eventgrid', 250, 330, 'Event Grid (alerts)');
      const siem = N('flow-process', 460, 130, 'Sentinel workspace');
      const rules = N('flow-process', 460, 330, 'Analytics rules');
      const playbook = N('az-logicapps', 670, 330, 'Logic App playbook');
      const entra = N('az-entra', 670, 130, 'Entra ID response');
      const monitor = N('az-monitor', 880, 330, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Logs in, coordinated incidents out'),
        sources,
        hubs,
        grid,
        siem,
        rules,
        playbook,
        entra,
        monitor,
        A(sources, 'right', hubs, 'left', { text: 'log forwarding' }),
        A(hubs, 'right', siem, 'left', { text: 'ingest (KQL)' }),
        A(grid, 'right', rules, 'left', { text: 'security events' }),
        A(siem, 'bottom', rules, 'top', { text: 'query schedule', routing: 'curved' }),
        A(rules, 'right', playbook, 'left', { text: 'incident trigger' }),
        A(playbook, 'top', entra, 'bottom', { text: 'disable user' }),
        A(playbook, 'right', monitor, 'left', { text: 'case timeline' }),
        NOTE(40, 560, 'Retention and ingestion cost are the two levers: forward only what a rule could act on. A playbook must run on a managed identity with exactly the one permission it needs, never a wide role.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-jamstack',
    name: 'AZX-09 JAMStack static site',
    description: 'Static Web App with Functions API → Cosmos DB + Blob content, delivered through Front Door',
    frameTitle: 'Lesson: a site with no servers to patch',
    teaching:
      'Everything that can be static is static: the HTML ships from a git branch, only the dynamic sliver is a Functions API, and both ride Front Door to the edge. When the CMS publishes, the app rebuilds — a content change is a deployment, not a database write on the hot path.',
    build() {
      const visitor = N('cloud-generic', 40, 130, 'Visitor');
      const cdn = N('az-frontdoor', 250, 130, 'Front Door (edge)');
      const site = N('az-staticweb', 460, 130, 'Static Web App');
      const api = N('az-functions', 460, 330, 'Functions API (built-in)');
      const db = N('az-cosmos', 670, 330, 'Cosmos DB (comments)');
      const media = N('az-blob', 670, 130, 'Blob media + content');
      const monitor = N('az-monitor', 880, 130, 'Azure Monitor');
      return [
        TITLE(40, 76, 'Static shell, dynamic sliver'),
        visitor,
        cdn,
        site,
        api,
        db,
        media,
        monitor,
        A(visitor, 'right', cdn, 'left', { text: 'HTTPS' }),
        A(cdn, 'right', site, 'left', { text: 'cached HTML' }),
        A(site, 'bottom', api, 'top', { text: '/api route' }),
        A(api, 'right', db, 'left', { text: 'read/write' }),
        A(site, 'right', media, 'left', { text: 'images, CSS' }),
        A(media, 'right', monitor, 'left', { text: 'edge logs' }),
        NOTE(40, 560, 'The build is part of the architecture: a broken dependency fails the pull request, not production. Stale content is fixed by a rebuild, never by editing files on a server.'),
      ];
    },
  }),

  diagram({
    id: 'tpl-azx-hub-spoke-fw',
    name: 'AZX-10 Hub-spoke with Azure Firewall',
    description: 'Virtual WAN hub with Azure Firewall → spokes via BGP, Bastion admin path, Private Endpoints to data',
    frameTitle: 'Lesson: hub-and-spoke with one firewall',
    teaching:
      'All traffic between spokes and the internet crosses the hub, so the firewall sees east-west traffic that flat peering would hide. Admins reach hosts through Bastion over RDP/SSH without a public IP, and Private Endpoints pull data services into the VNet — the storage account never needs a public endpoint at all.',
    build() {
      const onprem = N('cloud-generic', 40, 130, 'On-premises');
      const circuit = N('az-expressroute', 250, 130, 'ExpressRoute / VPN');
      const hub = N('az-firewall', 460, 130, 'vWAN hub + Azure Firewall');
      const spokeProd = N('az-vnet', 670, 130, 'Spoke: production');
      const spokeShared = N('az-vnet', 460, 330, 'Spoke: shared services');
      const bastion = N('az-bastion', 250, 330, 'Bastion (admin)');
      const pe = N('az-private-endpoint', 670, 330, 'Private Endpoint');
      const data = N('az-blob', 880, 330, 'Blob / SQL (data)');
      const nat = N('az-nat', 880, 130, 'NAT egress (per spoke)');
      return [
        TITLE(40, 76, 'One hub, inspected traffic, no public data plane'),
        onprem,
        circuit,
        hub,
        spokeProd,
        spokeShared,
        bastion,
        pe,
        data,
        nat,
        A(onprem, 'right', circuit, 'left', { text: 'private circuit' }),
        A(circuit, 'right', hub, 'left', { text: 'BGP' }),
        A(hub, 'right', spokeProd, 'left', { text: 'spoke peering' }),
        A(hub, 'bottom', spokeShared, 'top', { text: 'spoke peering' }),
        A(spokeShared, 'left', bastion, 'right', { text: 'admin session' }),
        A(spokeProd, 'bottom', pe, 'top', { text: 'private traffic' }),
        A(pe, 'right', data, 'left', { text: 'private DNS' }),
        A(spokeProd, 'right', nat, 'left', { text: 'egress only' }),
        NOTE(40, 560, 'Spoke-to-spoke traffic must be forced through the hub — default peering does not do that. Publish the data services on private DNS only, and a leaked connection string is still a dead end from the internet.'),
      ];
    },
  }),
];
