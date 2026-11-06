"""Run every Git workflow for real in a throwaway HOME and record what happened.

usage: record_git.py <workflow-data dir> <output json> <scratch dir> [workflow id ...]

For every command the output is recorded. For the state-tracked topics (the hello.txt journey)
a snapshot is also taken after each step: the file in the working folder, in the staging area,
the local commits with HEAD, and the remote. Naming specific workflow ids re-records only those
and merges them into an existing output file. Dates are fixed so hashes are repeatable; paths are
rewritten to /home/you. The "remote" is a bare repository in a local folder, standing in for
GitHub, GitLab or Bitbucket.
"""
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wfparse  # noqa: E402

data_dir, out_path, scratch = (os.path.abspath(p) for p in sys.argv[1:4])
only = set(sys.argv[4:])
RECORD = {'git', 'hello'}
STATE = {'hello'}
topics = [t for t in wfparse.parse_dir(data_dir) if t['id'] in RECORD]

PRELUDE = r'''
export HOME="$1"; cd "$HOME"
export GIT_CONFIG_NOSYSTEM=1 GIT_TERMINAL_PROMPT=0 GIT_PAGER=cat PAGER=cat LC_ALL=C
export GIT_AUTHOR_NAME="Srinivas" GIT_AUTHOR_EMAIL="srinivas@example.com"
export GIT_COMMITTER_NAME="Srinivas" GIT_COMMITTER_EMAIL="srinivas@example.com"
export GIT_CONFIG_COUNT=2 GIT_CONFIG_KEY_0=init.defaultBranch GIT_CONFIG_VALUE_0=main GIT_CONFIG_KEY_1=protocol.file.allow GIT_CONFIG_VALUE_1=always
T=1793000000
git() { T=$((T+90)); GIT_AUTHOR_DATE="@$T +0530" GIT_COMMITTER_DATE="@$T +0530" command git "$@"; }
snap() {
  command git rev-parse --git-dir >/dev/null 2>&1 || { echo "%%NOREPO"; echo "%%WORKING"; for f in $(ls -p | grep -v / | head -n 3); do echo "@@F $f"; head -n 6 "$f" | cut -c1-60; done; return 0; }
  local top f url
  top=$(command git rev-parse --show-toplevel)
  echo "%%HEAD"; command git -C "$top" symbolic-ref --short -q HEAD || echo "(detached)"; command git -C "$top" rev-parse --short HEAD 2>/dev/null
  echo "%%STATUS"; command git -C "$top" status --short 2>/dev/null | head -n 5
  echo "%%STAGED"; command git -C "$top" diff --cached --name-status 2>/dev/null | head -n 4
  echo "%%WORKING"
  for f in $(command git -C "$top" ls-files -co --exclude-standard | sort -u | head -n 3); do echo "@@F $f"; head -n 6 "$top/$f" 2>/dev/null | cut -c1-60; done
  echo "%%STAGING"
  for f in $(command git -C "$top" ls-files | sort -u | head -n 3); do echo "@@F $f"; command git -C "$top" show ":$f" 2>/dev/null | head -n 6 | cut -c1-60; done
  echo "%%LOCAL"; command git -C "$top" log --graph --oneline --decorate -n 7 --branches --remotes --tags HEAD 2>/dev/null | cut -c1-60
  url=$(command git -C "$top" remote get-url origin 2>/dev/null) || { echo "%%NOREMOTE"; return 0; }
  echo "%%REMOTE"; command git -C "$url" log --graph --oneline --decorate -n 5 --branches --tags 2>/dev/null | cut -c1-60
  echo "%%REMOTEFILE"; command git -C "$url" show main:hello.txt 2>/dev/null | head -n 4 | cut -c1-60
}
'''

MARK = re.compile(r'^@@@(S?) (\d+)(?: (\d+))?$', re.M)


def clean(text, home):
    for variant in {home, os.path.realpath(home)}:
        text = text.replace(variant, '/home/you')
    lines = [ln.rstrip() for ln in text.splitlines()]
    while lines and not lines[0]:
        lines.pop(0)
    while lines and not lines[-1]:
        lines.pop()
    return '\n'.join(lines)


def tidy_wc(cmd, text):
    if re.match(r'\s*wc\b', cmd):
        return re.sub(r'^\s+(\d+)\s+', r'\1 ', text, flags=re.M)
    return text


def files_of(lines):
    out = []
    for line in lines:
        if line.startswith('@@F '):
            out.append([line[4:], []])
        elif out:
            out[-1][1].append(line)
    return out


def parse_state(text, home):
    text = clean(text, home)
    sec, cur = {}, None
    for line in text.split('\n'):
        if line.startswith('%%'):
            cur = line[2:]
            sec[cur] = []
        elif cur:
            sec[cur].append(line)
    head = sec.get('HEAD', [])
    return {
        'branch': head[0] if head else '',
        'hash': head[1] if len(head) > 1 else '',
        'status': sec.get('STATUS', []),
        'staged': sec.get('STAGED', []),
        'working': files_of(sec.get('WORKING', [])),
        'staging': files_of(sec.get('STAGING', [])),
        'local': sec.get('LOCAL', []),
        'norepo': 'NOREPO' in sec,
        'remote': None if ('NOREMOTE' in sec or 'NOREPO' in sec) else sec.get('REMOTE', []),
        'remoteFile': sec.get('REMOTEFILE', []),
    }


previous = {}
if only and os.path.exists(out_path):
    previous = json.load(open(out_path))
result = dict(previous.get('workflows', {}))
states = dict(previous.get('states', {}))

for topic in topics:
    for wf in topic['workflows']:
        if only and wf['id'] not in only:
            continue
        home = os.path.join(scratch, wf['id'])
        shutil.rmtree(home, ignore_errors=True)
        os.makedirs(home)
        body = [PRELUDE]
        for si, step in enumerate(wf['steps']):
            for ci, cmd in enumerate(step['cmds']):
                path = os.path.join(home, f'.cmd_{si}_{ci}.sh')
                open(path, 'w').write(cmd + '\n')
                body.append(f'echo "@@@ {si} {ci}"\nsource "{path}" 2>&1 || true\n')
            if topic['id'] in STATE:
                body.append(f'echo "@@@S {si}"\nsnap\n')
        script = os.path.join(home, '.run.sh')
        open(script, 'w').write('\n'.join(body))
        proc = subprocess.run(['bash', script, home], capture_output=True, text=True, timeout=120, cwd=home)
        parts = MARK.split(proc.stdout)
        outs, snaps = {}, {}
        for i in range(1, len(parts), 4):
            kind, si, ci, text = parts[i], int(parts[i + 1]), parts[i + 2], parts[i + 3]
            if kind == 'S':
                snaps[si] = parse_state(text, home)
            else:
                cmd = wf['steps'][si]['cmds'][int(ci)]
                outs.setdefault(si, []).append({'cmd': cmd, 'out': tidy_wc(cmd, clean(text, home))})
        result[wf['id']] = {str(k): v for k, v in outs.items()}
        if snaps:
            states[wf['id']] = {str(k): v for k, v in snaps.items()}
        shown = sum(1 for v in outs.values() for o in v if o['out'])
        print(f"{wf['id']:26s} steps={len(wf['steps']):2d} commands={sum(len(v) for v in outs.values()):3d} "
              f"with-output={shown:3d} states={len(snaps):2d} stderr={len(proc.stderr)}")
        shutil.rmtree(home, ignore_errors=True)

version = subprocess.run(['git', '--version'], capture_output=True, text=True).stdout.strip()
json.dump({'tool': version, 'workflows': result, 'states': states}, open(out_path, 'w'), indent=1)
print('recorded with', version)
