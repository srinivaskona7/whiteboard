"""Generate the whiteboard's workflow data from workflows/data/wf_*.txt and qna_*.txt.

usage: python3 workflows/tools/build.py   (or: npm run workflows:build)
Writes <repo>/templates/workflows-data.js (full data, lazy-loaded) and
<repo>/templates/workflows-index.js (small index used by the library tab, palette and menu).
Every step icon is validated against the repo's real stencil registry, every workflow needs 2-3
Q&A pairs, and Git topics take their output (and, for the hello.txt journey, their file-state
snapshots) from generated/git-recorded.json, which tools/record_git.py produced by really running
the commands.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import wfparse  # noqa: E402

ROOT = os.path.dirname(HERE)                                   # <repo>/workflows
repo = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.dirname(ROOT)
DATA = os.path.join(ROOT, 'data')
GEN = os.path.join(ROOT, 'generated')

# glyph (workflow files) -> stencil id in the whiteboard registry
GLYPH = {
    'ban': 'lucide-ban', 'bell': 'lucide-bell', 'bolt': 'lucide-zap', 'book': 'lucide-book-open',
    'branch': 'lucide-git-branch', 'bug': 'lucide-bug', 'calendar': 'lucide-calendar', 'chart': 'lucide-chart-line',
    'check': 'lucide-check', 'chip': 'lucide-cpu', 'clipboard': 'lucide-clipboard-list', 'clock': 'lucide-clock',
    'cloud': 'lucide-cloud', 'code': 'lucide-code', 'commit': 'lucide-git-commit', 'copy': 'lucide-files',
    'cube': 'lucide-box', 'database': 'lucide-database', 'diff': 'lucide-arrow-left-right', 'doc': 'lucide-file-text',
    'download': 'lucide-download', 'edit': 'lucide-pencil', 'eye': 'lucide-eye', 'filter': 'lucide-filter',
    'firewall': 'lucide-shield-ban', 'flask': 'lucide-flask-conical', 'folder': 'lucide-folder',
    'gate': 'lucide-door-open', 'gauge': 'lucide-timer', 'gear': 'lucide-settings', 'globe': 'lucide-globe',
    'hash': 'lucide-calculator', 'heart': 'lucide-heart', 'helm': 'lucide-container', 'key': 'lucide-key-round',
    'laptop': 'lucide-laptop', 'layers': 'lucide-layers', 'lb': 'lucide-network', 'link': 'lucide-link',
    'listcheck': 'lucide-list-checks', 'lock': 'lucide-lock', 'login': 'lucide-log-in', 'map': 'lucide-signpost',
    'menu': 'lucide-list-todo', 'merge': 'lucide-git-merge', 'minus': 'lucide-minus', 'nat': 'lucide-arrow-left-right',
    'network': 'lucide-network', 'package': 'lucide-package', 'pin': 'lucide-pin', 'pipeline': 'lucide-arrow-right',
    'play': 'lucide-play', 'plug': 'lucide-plug', 'plus': 'lucide-plus', 'power': 'lucide-power',
    'retry': 'lucide-refresh-cw', 'rocket': 'lucide-rocket', 'save': 'lucide-save', 'scale': 'lucide-equal',
    'search': 'lucide-search', 'server': 'lucide-server', 'shield': 'lucide-shield', 'sliders': 'lucide-sliders-horizontal',
    'snap': 'lucide-camera', 'stop': 'lucide-circle-slash', 'swap': 'lucide-repeat', 'table': 'lucide-table',
    'tag': 'lucide-bookmark', 'target': 'lucide-target', 'terminal': 'lucide-terminal', 'toggleon': 'lucide-check-check',
    'trash': 'lucide-eraser', 'tunnel': 'lucide-cable', 'undo': 'lucide-undo-2', 'up': 'lucide-arrow-up',
    'upload': 'lucide-upload', 'user': 'lucide-user', 'users': 'lucide-users', 'warn': 'lucide-triangle-alert',
    'wrench': 'lucide-wrench',
}
CONFIG = json.load(open(os.path.join(ROOT, 'topics.json')))
TOPIC_ICON = CONFIG.get('icons', {})
TOPIC_ORDER = CONFIG.get('order', [])
RECORDED_TOPICS = {'git', 'hello'}  # output comes from really running the commands
STATE_TOPICS = {'hello'}            # plus a recorded "where is the file now" snapshot per step

known = {s['id'] for s in json.load(open(os.path.join(GEN, 'stencil-ids.json')))}
topics = wfparse.parse_dir(DATA)
topics.sort(key=lambda t: (TOPIC_ORDER.index(t['id']) if t['id'] in TOPIC_ORDER else len(TOPIC_ORDER), t['id']))
qna = wfparse.parse_qna(DATA)
recorded_doc = json.load(open(os.path.join(GEN, 'git-recorded.json')))
recorded, states, tool = recorded_doc['workflows'], recorded_doc.get('states', {}), recorded_doc['tool']
problems = []


def stencil(glyph, where):
    sid = glyph if glyph in known else GLYPH.get(glyph)
    if sid not in known:
        problems.append(f'{where}: no stencil for glyph {glyph!r}')
        return 'lucide-circle'
    return sid


def recorded_output(wf_id, index):
    chunks = []
    for item in recorded.get(wf_id, {}).get(str(index), []):
        if item['out']:
            chunks.append('$ ' + item['cmd'].split('\n')[0] + '\n' + item['out'])
    return '\n\n'.join(chunks)


data, index = [], {'topics': [], 'workflows': []}
for topic in topics:
    out_topic = {'id': topic['id'], 'name': topic['name'], 'color': topic['color'], 'tagline': topic['tagline'],
                 'icon': TOPIC_ICON.get(topic['id'], stencil(topic['glyph'], topic['id'])), 'workflows': []}
    for wf in topic['workflows']:
        steps = []
        for i, step in enumerate(wf['steps']):
            where = f"{wf['id']} step {i + 1}"
            out, kind, state = '', '', None
            if topic['id'] in RECORDED_TOPICS:
                out = recorded_output(wf['id'], i)
                kind = 'recorded' if out else ''
            elif step['out']:
                out, kind = step['out'], 'example'
            if topic['id'] in STATE_TOPICS:
                state = states.get(wf['id'], {}).get(str(i))
                if state is None:
                    problems.append(f'{where}: no recorded file state (run tools/record_git.py)')
            viz = '\n'.join(f"{m['from']} \u2192 {m['to']}: {m['label']}" for m in step['viz'])
            item = {'title': step['title'], 'icon': stencil(step['glyph'], where), 'text': step['text'],
                    'cmd': '\n'.join(step['cmds']), 'out': out, 'outKind': kind, 'note': step['note'],
                    'risk': step['risk'], 'viz': viz}
            if state is not None:
                item['state'] = state
            steps.append(item)
        pairs = qna.get(wf['id'], [])
        if not 2 <= len(pairs) <= 3:
            problems.append(f"{wf['id']}: needs 2-3 Q&A pairs, has {len(pairs)}")
        out_topic['workflows'].append({'id': wf['id'], 'title': wf['title'], 'level': wf['level'],
                                       'icon': stencil(wf['glyph'], wf['id']), 'summary': wf['summary'],
                                       'qna': pairs, 'steps': steps})
    # previous / next module within the topic, in file order
    ws = out_topic['workflows']
    for pos, w in enumerate(ws):
        w['nav'] = {'pos': pos + 1, 'of': len(ws),
                    'prev': {'id': ws[pos - 1]['id'], 'title': ws[pos - 1]['title']} if pos > 0 else None,
                    'next': {'id': ws[pos + 1]['id'], 'title': ws[pos + 1]['title']} if pos + 1 < len(ws) else None}
        index['workflows'].append({'id': w['id'], 'topic': topic['id'], 'title': w['title'], 'level': w['level'],
                                   'steps': len(w['steps']), 'summary': w['summary'], 'pos': pos + 1, 'of': len(ws)})
    data.append(out_topic)
    index['topics'].append({'id': topic['id'], 'name': topic['name'], 'color': topic['color'],
                            'tagline': topic['tagline'], 'count': len(ws)})

known_ids = {w['id'] for t in topics for w in t['workflows']}
problems += [f'qna for unknown workflow {i}' for i in qna if i not in known_ids]
if problems:
    print('\n'.join(problems))
    sys.exit(1)

head = '// GENERATED by workflows/tools/build.py \u2014 do not edit by hand.\n'
dump = lambda obj: json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(repo, 'templates', 'workflows-data.js'), 'w', encoding='utf-8').write(
    head + f'// Git output and file states were recorded by running every command with {tool}; other outputs are labelled examples.\n'
    f'export const GIT_RECORDED_WITH = {json.dumps(tool)};\nexport const WORKFLOW_TOPICS = {dump(data)};\n')
open(os.path.join(repo, 'templates', 'workflows-index.js'), 'w', encoding='utf-8').write(
    head + f'export const WORKFLOW_INDEX = {dump(index)};\n')
steps_total = sum(len(w['steps']) for t in data for w in t['workflows'])
print(f"wrote {len(index['workflows'])} workflows, {steps_total} steps, {len(data)} topics")
for t in index['topics']:
    print(f"  {t['id']:10s} {t['count']}")
