// stencils/workflow-icons.js — concept icons for the step-by-step workflows (Git, Linux, Ansible,
// Networking, run status). One original line drawing per idea on a 24x24 grid, drawn in the same
// style as the Lucide set (2px round strokes) so they sit next to each other without clashing.
//
// Each icon is data: a string is an SVG path, [cx, cy, r] is a circle, [x, y, w, h, rx] a rect.
// The canvas draw and the SVG export are both generated from that one definition.

const SIZE = 24;

const GROUPS = {
  git: 'icons/workflow-git',
  linux: 'icons/workflow-linux',
  ansible: 'icons/workflow-ansible',
  network: 'icons/workflow-network',
  status: 'icons/workflow-status',
};

// [id suffix, name, group, search tags, shapes]
const DEFS = [
  // ---- Git ----
  ['bisect', 'Bisect', 'git', 'binary search halve history bad good', [[5, 12, 2], [12, 12, 3], [19, 12, 2], 'M7 12h2M15 12h2M12 3v5M10 6l2 2 2-2']],
  ['worktree', 'Worktree', 'git', 'second folder branch checkout parallel', [[3, 4, 8, 7, 1], [13, 13, 8, 7, 1], 'M7 11v5h6']],
  ['submodule', 'Submodule', 'git', 'repo inside repo nested dependency', [[3, 3, 18, 18, 2], [8, 8, 8, 8, 1]]],
  ['stash', 'Stash', 'git', 'shelf park changes temporarily', ['M3 19h18M6 19V9h12v10M9 9V5h6v4']],
  ['reflog', 'Reflog', 'git', 'rewind history recover undo', ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2']],
  ['conflict', 'Merge Conflict', 'git', 'crossed clash both changed', ['M3 5l7 7-7 7M21 5l-7 7 7 7']],
  ['squash', 'Squash', 'git', 'combine commits fixup collapse', ['M4 6h16M4 10h16M12 14v6M9 17l3 3 3-3']],
  ['patch', 'Patch File', 'git', 'format-patch diff mail apply am', ['M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M12 10v6']],
  ['signed-commit', 'Signed Commit', 'git', 'gpg verified seal trust', [[12, 9, 6], 'M9 9l2 2 4-4M9 14l-1 7 4-2 4 2-1-7']],
  ['lfs', 'Large File', 'git', 'lfs binary heavy weight', [[12, 5, 2], 'M7 20l1-10h8l1 10z']],
  ['cherry-pick', 'Cherry-pick', 'git', 'copy one commit another branch', [[8, 17, 3], [16, 17, 3], 'M8 14c0-5 3-8 5-10M16 14c0-5-1-8-3-10M13 4c2-1 4 0 5 1']],
  ['object', 'Git Object', 'git', 'blob tree hash sha content', ['M12 3l8 4v10l-8 4-8-4V7zM4 7l8 4 8-4M12 11v10']],
  // ---- Linux ----
  ['symlink', 'Symbolic Link', 'linux', 'ln -s shortcut pointer path', ['M4 20L18 6M9 6h9v9']],
  ['hardlink', 'Hard Link', 'linux', 'ln second name same inode', [[5, 6, 2], [5, 18, 2], [19, 12, 3], 'M7 6l9 5M7 18l9-5']],
  ['inode', 'Inode', 'linux', 'file metadata number ls -i', ['M9 4v16M15 4v16M4 9h16M4 15h16']],
  ['mount', 'Mount Point', 'linux', 'disk attach fstab filesystem', [[3, 14, 18, 6, 1], [7, 17, 1], 'M12 3v8M9 8l3 3 3-3']],
  ['swap-space', 'Swap Space', 'linux', 'memory ram disk paging', ['M4 8h14l-3-3M20 16H6l3 3']],
  ['pipe', 'Pipe', 'linux', 'output input chain |', ['M3 12h6M15 12h6M12 4v16M18 9l3 3-3 3']],
  ['redirect', 'Redirect', 'linux', '> file output write', ['M4 6l8 6-8 6M14 18h6']],
  ['cron', 'Scheduled Job', 'linux', 'cron timer repeat schedule', [[12, 12, 9], 'M12 7v5l3 2M12 1v2']],
  ['namespace', 'Namespace', 'linux', 'isolation container view unshare', [[3, 3, 18, 18, 2], [7, 7, 10, 10, 1.5], [10, 10, 4, 4, 1]]],
  ['cgroup', 'Control Group', 'linux', 'cgroup limit cpu memory resources', [[3, 3, 18, 18, 2], 'M7 15a5 5 0 0 1 10 0M12 15l3-4']],
  ['socket', 'Socket', 'linux', 'plug connection endpoint', ['M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3']],
  ['daemon', 'Daemon', 'linux', 'service background process systemd', [[12, 12, 3], 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2']],
  ['signal', 'Signal', 'linux', 'kill sigterm sighup interrupt', ['M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0', [12, 14, 1.5], 'M12 15.5V21']],
  ['exit-code', 'Exit Code', 'linux', 'return status $? success failure', [[3, 4, 18, 16, 2], 'M7 10l3 2-3 2M13 15h4']],
  ['sudo', 'Sudo / Root', 'linux', 'administrator privilege root shield', ['M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 9v4M12 16v.5']],
  ['tmux', 'Terminal Panes', 'linux', 'tmux split session multiplexer', [[3, 4, 18, 16, 2], 'M12 4v16M12 12h9']],
  ['label', 'Security Label', 'linux', 'selinux context type tag', ['M3 12l9-9h8v8l-9 9z', [16, 8, 1.5]]],
  // ---- Ansible ----
  ['playbook', 'Playbook', 'ansible', 'plays tasks yaml run', ['M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zM10 8l5 3-5 3z']],
  ['role', 'Role', 'ansible', 'reusable puzzle piece structure', ['M3 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H3z']],
  ['handler', 'Handler', 'ansible', 'notify restart bell trigger', ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4']],
  ['inventory', 'Inventory', 'ansible', 'hosts groups list servers', [[5, 6, 1.5], [5, 12, 1.5], [5, 18, 1.5], 'M10 6h11M10 12h11M10 18h11']],
  ['fact', 'Fact', 'ansible', 'gather facts host data discover', [[3, 4, 12, 10, 1.5], [16, 16, 4], 'M19 19l3 3']],
  ['vault', 'Vault', 'ansible', 'secret encrypt safe password', [[3, 4, 18, 16, 2], [12, 12, 3.5], 'M12 8.5V6M12 18v-2.5']],
  ['template', 'Template', 'ansible', 'jinja2 braces variables render', ['M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1']],
  ['idempotent', 'Idempotent', 'ansible', 'same result repeat safe equals', [[12, 12, 9], 'M8 10h8M8 14h8']],
  ['dry-run', 'Dry Run', 'ansible', 'check mode preview simulate diff', ['M4 11l5 5 11-11M3 20h4M10 20h4M17 20h4']],
  ['loop', 'Loop', 'ansible', 'repeat items iterate', ['M20 12a8 8 0 1 1-3-6.2M20 4v5h-5']],
  ['register', 'Register / Variable', 'ansible', 'variable store result chip', [[4, 7, 16, 10, 2], 'M8 3v4M12 3v4M16 3v4M8 17v4M12 17v4M16 17v4']],
  ['tag', 'Tag', 'ansible', 'label select run only', ['M3 12V4h8l10 10-8 8z', [7.5, 8.5, 1.5]]],
  // ---- Networking ----
  ['handshake', 'Three-way Handshake', 'network', 'syn ack tcp connect', ['M4 6h14l-3-3M20 12H6l3-3M4 18h14l-3-3']],
  ['packet', 'Packet', 'network', 'datagram frame data envelope', [[3, 6, 18, 12, 2], 'M3 8l9 6 9-6']],
  ['port', 'Port', 'network', 'tcp udp number listening', [[4, 8, 16, 8, 1.5], 'M8 11v2M12 11v2M16 11v2']],
  ['nat-swap', 'NAT', 'network', 'address translation masquerade', [[2, 4, 8, 6, 1], [14, 14, 8, 6, 1], 'M12 7h8l-2-2M12 17H4l2 2']],
  ['bastion', 'Bastion Host', 'network', 'jump host gate tower', ['M4 21V8l2-2h2v2h2V6h4v2h2V6h2l2 2v13zM10 21v-5a2 2 0 0 1 4 0v5']],
  ['tunnel', 'Tunnel', 'network', 'vpn ssh forward arch', ['M3 18v-5a9 9 0 0 1 18 0v5M7 18v-5a5 5 0 0 1 10 0v5']],
  ['ttl', 'TTL', 'network', 'time to live hourglass cache expire', ['M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9']],
  ['gateway', 'Gateway', 'network', 'router exit default door', [[4, 4, 8, 16, 0], 'M12 12h9M18 9l3 3-3 3']],
  ['subnet', 'Subnet', 'network', 'cidr range split network', [[3, 3, 18, 18, 2], 'M3 12h18M12 3v18']],
  ['cidr', 'CIDR Block', 'network', 'prefix slash mask bits', ['M15 4L9 20M3 9h3M3 15h3M18 9h3M18 15h3']],
  ['peering', 'VPC Peering', 'network', 'connect two networks private link', [[2, 8, 7, 8, 1.5], [15, 8, 7, 8, 1.5], 'M9 12h6']],
  ['endpoint', 'Endpoint', 'network', 'private access service target', [[12, 12, 3], 'M12 3v6M12 15v6M3 12h6M15 12h6']],
  ['load-balancer', 'Load Balancer', 'network', 'distribute spread traffic backends', [[5, 12, 2], [19, 5, 2], [19, 12, 2], [19, 19, 2], 'M7 12h10M7 11l10-5M7 13l10 5']],
  ['firewall-wall', 'Firewall', 'network', 'brick wall block filter rules', [[3, 4, 18, 16, 1], 'M3 9.3h18M3 14.6h18M9 4v5.3M15 9.3v5.3M9 14.6V20']],
  // ---- Run status ----
  ['passed', 'Passed', 'status', 'ok success done green', [[12, 12, 9], 'M8 12l3 3 5-6']],
  ['failed', 'Failed', 'status', 'error failure red broken', [[12, 12, 9], 'M9 9l6 6M15 9l-6 6']],
  ['skipped', 'Skipped', 'status', 'skip bypass next', ['M5 5l7 7-7 7M13 5l7 7-7 7']],
  ['changed', 'Changed', 'status', 'modified delta different', [[12, 12, 9], 'M12 7l5 9H7z']],
  ['unreachable', 'Unreachable', 'status', 'offline no connection down', ['M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M9 16a5 5 0 0 1 6 0', [12, 19, 1], 'M3 3l18 18']],
  ['rescued', 'Rescued', 'status', 'recovered lifebuoy fallback rescue', [[12, 12, 9], [12, 12, 4], 'M5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2']],
];

function toSvg(shapes) {
  return shapes
    .map((s) => {
      if (typeof s === 'string') return `<path d="${s}" />`;
      if (s.length === 3) return `<circle cx="${s[0]}" cy="${s[1]}" r="${s[2]}" />`;
      return `<rect x="${s[0]}" y="${s[1]}" width="${s[2]}" height="${s[3]}" rx="${s[4] || 0}" />`;
    })
    .join('');
}

function drawShapes(shapes) {
  return (ctx, x, y, w, h) => {
    const pad = 8;
    const scale = (Math.min(w, h) - pad * 2) / SIZE;
    if (!(scale > 0)) return;
    ctx.save();
    ctx.translate(x + (w - SIZE * scale) / 2, y + (h - SIZE * scale) / 2);
    ctx.scale(scale, scale);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of shapes) {
      ctx.beginPath();
      if (typeof s === 'string') {
        if (typeof Path2D === 'function') {
          ctx.stroke(new Path2D(s));
          continue;
        }
      } else if (s.length === 3) {
        ctx.arc(s[0], s[1], s[2], 0, Math.PI * 2);
      } else if (typeof ctx.roundRect === 'function' && s[4]) {
        ctx.roundRect(s[0], s[1], s[2], s[3], s[4]);
      } else {
        ctx.rect(s[0], s[1], s[2], s[3]);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
}

export const WORKFLOW_ICON_GROUPS = Object.freeze({ ...GROUPS });

export const WORKFLOW_ICON_STENCILS = DEFS.map(([key, name, group, tags, shapes]) => {
  const inner = toSvg(shapes);
  return {
    id: `wf-${key}`,
    name,
    category: GROUPS[group],
    defaultText: ' ',
    tags: `${name.toLowerCase()} ${group} workflow concept ${tags}`,
    draw: drawShapes(shapes),
    toSvg(x, y, w, h) {
      const pad = 8;
      const scale = (Math.min(w, h) - pad * 2) / SIZE;
      if (!(scale > 0)) return '';
      const tx = x + (w - SIZE * scale) / 2;
      const ty = y + (h - SIZE * scale) / 2;
      return (
        `<g transform="translate(${tx} ${ty}) scale(${scale})" fill="none" stroke="currentColor"` +
        ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`
      );
    },
    svgInner: inner,
  };
});
