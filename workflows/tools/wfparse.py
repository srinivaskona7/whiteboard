"""Parser for the workflow text format (workflow-data/wf_*.txt).

Header lines:   @topic id | Name | #color | glyph | tagline
                = id | Title | level 1-4 | glyph | summary
                > Step title | glyph
Step keys:      text: cmd: out: note: risk: viz: fx:
In values, \\n is a line break and \\\\n is a literal backslash-n.
"""
import glob
import os
import re

_LIT = '\x00LIT\x00'
KEYS = ('text', 'cmd', 'out', 'note', 'risk', 'viz', 'fx')
FX_OPS = {'new', 'edit', 'del', 'stage', 'unstage', 'restore', 'commit', 'init', 'switch', 'branch', 'merge',
          'revert', 'reset', 'stash', 'pop', 'push', 'tag', 'amend', 'conflict', 'resolve', 'pick', 'rebase'}


def expand(value):
    return value.replace('\\\\n', _LIT).replace('\\n', '\n').replace(_LIT, '\\n')


def parse_viz(value):
    out = []
    for part in value.split(' ; '):
        m = re.match(r'^(.*?)>(.*?):(.*)$', part.strip())
        if not m:
            raise ValueError(f'bad viz segment: {part!r}')
        out.append({'from': m.group(1).strip(), 'to': m.group(2).strip(), 'label': m.group(3).strip()})
    return out


def parse_fx(value):
    ops = []
    for part in value.split(';'):
        part = part.strip()
        if not part:
            continue
        bits = re.findall(r'"[^"]*"|\S+', part)
        op, args = bits[0], [b.strip('"') for b in bits[1:]]
        if op not in FX_OPS:
            raise ValueError(f'unknown fx op: {op!r}')
        ops.append({'op': op, 'args': args})
    return ops


def parse_file(path):
    topics, topic, wf, step = [], None, None, None
    for number, raw in enumerate(open(path, encoding='utf-8').read().splitlines(), 1):
        line = raw.rstrip()
        if not line or line.startswith('#'):
            continue
        where = f'{os.path.basename(path)}:{number}'
        if line.startswith('@topic'):
            p = [x.strip() for x in line[len('@topic'):].split('|', 4)]
            topic = {'id': p[0], 'name': p[1], 'color': p[2], 'glyph': p[3], 'tagline': p[4], 'workflows': []}
            topics.append(topic)
        elif line.startswith('= '):
            p = [x.strip() for x in line[2:].split('|', 4)]
            wf = {'id': p[0], 'title': p[1], 'level': int(p[2]), 'glyph': p[3], 'summary': p[4], 'steps': []}
            topic['workflows'].append(wf)
            step = None
        elif line.startswith('> '):
            p = [x.strip() for x in line[2:].split('|', 1)]
            step = {'title': p[0], 'glyph': p[1], 'text': '', 'cmds': [], 'out': '', 'note': '', 'risk': False,
                    'viz': [], 'fx': []}
            wf['steps'].append(step)
        else:
            m = re.match(r'^(text|cmd|out|note|risk|viz|fx):\s?(.*)$', line)
            if not m or step is None:
                raise ValueError(f'{where}: unexpected line: {line[:70]!r}')
            key, value = m.group(1), m.group(2)
            if key == 'cmd':
                step['cmds'].append(expand(value))
            elif key == 'risk':
                step['risk'] = value.strip() in ('1', 'true', 'yes')
            elif key == 'viz':
                step['viz'] = parse_viz(value)
            elif key == 'fx':
                step['fx'] = parse_fx(value)
            else:
                step[key] = expand(value)
    return topics


def parse_dir(directory):
    topics = []
    for path in sorted(glob.glob(os.path.join(directory, 'wf_*.txt'))):
        topics += parse_file(path)
    return topics


_HEREDOC = re.compile(r"^(?P<head>.*?)<<\s*['\"]?(?P<tag>[A-Z_]+)['\"]?\s*\n(?P<body>.*?)\n(?P=tag)\s*$", re.S)
_TARGET = re.compile(r"(?:cat\s*>>?\s*|tee\s+(?:-a\s+)?)(?P<path>[^\s>|]+)")


def extract_files(cmd):
    """Return (path, content) when a command writes a file through a heredoc."""
    m = _HEREDOC.match(cmd)
    if not m:
        return None
    t = _TARGET.search(m.group('head'))
    if not t:
        return None
    return t.group('path'), m.group('body') + '\n'


def parse_qna(directory):
    """Read qna_*.txt: '= id', then q:/a: pairs. Returns {workflow id: [{'q','a'}]}."""
    out = {}
    for path in sorted(glob.glob(os.path.join(directory, 'qna_*.txt'))):
        cur, question = None, None
        for number, raw in enumerate(open(path, encoding='utf-8').read().splitlines(), 1):
            line = raw.rstrip()
            where = f'{os.path.basename(path)}:{number}'
            if not line or line.startswith('#'):
                continue
            if line.startswith('= '):
                cur = line[2:].strip()
                if cur in out:
                    raise ValueError(f'{where}: duplicate qna id {cur}')
                out[cur] = []
            elif line.startswith('q:') and cur:
                question = line[2:].strip()
            elif line.startswith('a:') and cur and question:
                out[cur].append({'q': question, 'a': line[2:].strip()})
                question = None
            else:
                raise ValueError(f'{where}: unexpected line: {line[:70]!r}')
    return out
