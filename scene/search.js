// scene/search.js — one local search index across actions, library, objects and lesson text.
// Everything here runs in memory on bundled/local data; nothing is uploaded.
export const SEARCH_SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'actions', label: 'Actions' },
  { id: 'library', label: 'Library' },
  { id: 'objects', label: 'This board' },
  { id: 'lesson', label: 'Lesson' },
];

export const SEARCH_FILTERS = [
  { id: 'any', label: 'Any type' },
  { id: 'tool', label: 'Tools' },
  { id: 'action', label: 'Commands' },
  { id: 'template', label: 'Templates' },
  { id: 'stencil', label: 'Icons' },
  { id: 'element', label: 'Objects' },
  { id: 'group', label: 'Groups' },
  { id: 'note', label: 'Notes' },
];

const normalize = (value) => String(value || '').toLowerCase().normalize('NFKD');
const subtitlesJoin = (subtitle) => (Array.isArray(subtitle) ? subtitle.join(' ') : subtitle || '');

export function tokenize(query) {
  return normalize(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Bounded edit distance (0 or 1) for typo tolerance on short queries.
export function withinOneEdit(token, word) {
  if (token === word) return true;
  if (Math.abs(token.length - word.length) > 1) return false;
  // A single adjacent transposition counts as one edit ("tabel" -> "table").
  if (token.length === word.length) {
    let first = -1;
    for (let k = 0; k < token.length; k++) {
      if (token[k] !== word[k]) {
        if (first === -1) first = k;
        else {
          if (k !== first + 1) break;
          if (token[first] === word[k] && token[k] === word[first]) {
            const rest = token.slice(k + 1);
            if (rest === word.slice(k + 1)) return true;
          }
          break;
        }
      }
    }
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < token.length && j < word.length) {
    if (token[i] === word[j]) {
      i++;
      j++;
      continue;
    }
    edits++;
    if (edits > 1) return false;
    if (token.length > word.length) i++;
    else if (token.length < word.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (token.length - i) + (word.length - j) <= 1;
}

export function createEntry({
  id,
  scope,
  kind,
  title,
  subtitle = '',
  keywords = '',
  preview = '',
  visibility = 'shared',
  run = null,
  data = null,
}) {
  return {
    id,
    scope,
    kind,
    title: String(title || ''),
    subtitle: String(subtitle || ''),
    keywords: `${String(title || '')} ${String(keywords || '')}`,
    preview: String(preview || ''),
    visibility,
    run,
    data,
    normTitle: normalize(title),
    normKeywords: normalize(`${title} ${subtitlesJoin(subtitle)} ${keywords}`),
  };
}

/** Rank one entry against tokens. 0 means no match. */
export function scoreEntry(entry, tokens) {
  if (!tokens.length) return 1;
  let score = 0;
  for (const token of tokens) {
    if (entry.normTitle === token) {
      score += 100;
      continue;
    }
    if (entry.normTitle.startsWith(token)) {
      score += 60;
      continue;
    }
    const titleWords = entry.normTitle.split(/\s+/);
    if (titleWords.some((w) => w.startsWith(token))) {
      score += 45;
      continue;
    }
    if (entry.normTitle.includes(token)) {
      score += 30;
      continue;
    }
    if (entry.normKeywords.includes(token)) {
      score += 15;
      continue;
    }
    if (titleWords.some((w) => w.length > 2 && withinOneEdit(token, w))) {
      score += 8;
      continue;
    }
    return 0;
  }
  return score;
}

/**
 * Rank the full index. `searchEntries` keeps the array shape used elsewhere;
 * this variant also reports how many matches existed before the limit so a UI
 * can say "showing first N of M" instead of silently dropping results.
 */
export function searchEntriesDetailed(entries, query, options = {}) {
  const { limit = 40, ...rest } = options;
  const all = searchEntries(entries, query, { ...rest, limit: Number.MAX_SAFE_INTEGER });
  return { items: all.slice(0, limit), total: all.length };
}

export function searchEntries(entries, query, options = {}) {
  const { scope = 'all', filter = 'any', limit = 40, studentMode = false } = options;
  const tokens = tokenize(query);

  const scoped = entries.filter((entry) => {
    if (scope !== 'all' && entry.scope !== scope) return false;
    if (filter !== 'any' && entry.kind !== filter) return false;
    // Teacher-private notes never appear in a student-facing surface.
    if (studentMode && entry.visibility === 'teacher') return false;
    return true;
  });

  const scored = [];
  for (const entry of scoped) {
    const score = scoreEntry(entry, tokens);
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.title.localeCompare(b.entry.title);
  });

  return scored.slice(0, limit).map(({ entry, score }) => ({
    ...entry,
    score,
    matchedTerms: tokens.filter((t) => entry.normKeywords.includes(t)),
  }));
}

/** Local, offline recent/favourite storage. */
export function loadSearchPrefs(storage = globalThis.localStorage) {
  if (!storage) return { recents: [], favourites: [], recentQueries: [], favouriteQueries: [] };
  try {
    const raw = storage.getItem('wb-search-prefs');
    if (!raw) return { recents: [], favourites: [], recentQueries: [], favouriteQueries: [] };
    const parsed = JSON.parse(raw);
    return {
      recents: Array.isArray(parsed.recents) ? parsed.recents.slice(0, 12) : [],
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites.slice(0, 40) : [],
      recentQueries: Array.isArray(parsed.recentQueries) ? parsed.recentQueries.slice(0, 8) : [],
      favouriteQueries: Array.isArray(parsed.favouriteQueries) ? parsed.favouriteQueries.slice(0, 12) : [],
    };
  } catch {
    return { recents: [], favourites: [], recentQueries: [], favouriteQueries: [] };
  }
}

export function saveSearchPrefs(prefs, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(
      'wb-search-prefs',
      JSON.stringify({
        recents: prefs.recents || [],
        favourites: prefs.favourites || [],
        recentQueries: prefs.recentQueries || [],
        favouriteQueries: prefs.favouriteQueries || [],
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function pushRecent(prefs, entryId) {
  const recents = [entryId, ...(prefs.recents || []).filter((id) => id !== entryId)].slice(0, 12);
  return { ...prefs, recents };
}

/** Remember the query itself, so a previous search can be re-run in one click. */
export function pushRecentQuery(prefs, query) {
  const q = String(query || '').trim();
  if (!q) return prefs;
  const recentQueries = [q, ...(prefs.recentQueries || []).filter((x) => x !== q)].slice(0, 8);
  return { ...prefs, recentQueries };
}

export function toggleFavouriteQuery(prefs, query) {
  const q = String(query || '').trim();
  if (!q) return prefs;
  const list = prefs.favouriteQueries || [];
  return {
    ...prefs,
    favouriteQueries: list.includes(q)
      ? list.filter((x) => x !== q)
      : [q, ...list].slice(0, 12),
  };
}

export function toggleFavourite(prefs, entryId) {
  const favourites = prefs.favourites || [];
  return {
    ...prefs,
    favourites: favourites.includes(entryId)
      ? favourites.filter((id) => id !== entryId)
      : [entryId, ...favourites].slice(0, 40),
  };
}

/** Build the searchable universe from live app state. */
export function buildSearchEntries({
  commands = [],
  stencils = [],
  templates = [],
  pages = [],
  activePageId = null,
  aliases = {},
} = {}) {
  const entries = [];
  // Reverse the alias table once: stencil id -> ["r53", "route53", ...].
  const aliasTokens = new Map();
  for (const [alias, ids] of Object.entries(aliases || {})) {
    for (const id of ids || []) {
      if (!aliasTokens.has(id)) aliasTokens.set(id, []);
      aliasTokens.get(id).push(alias);
    }
  }
  for (const cmd of commands) {
    entries.push(
      createEntry({
        id: cmd.id,
        scope: 'actions',
        kind: 'action',
        title: cmd.title,
        subtitle: cmd.shortcut ? `Shortcut ${cmd.shortcut}` : '',
        keywords: cmd.keywords || '',
        run: cmd.run,
        data: cmd,
      })
    );
  }
  for (const stencil of stencils) {
    const alias = (aliasTokens.get(stencil.id) || []).join(' ');
    entries.push(
      createEntry({
        id: `stencil:${stencil.id}`,
        scope: 'library',
        kind: 'stencil',
        title: stencil.name,
        subtitle: stencil.category,
        keywords: `${stencil.tags || ''} ${stencil.id} ${alias} icon shape symbol`,
        preview: stencil.defaultText || '',
        data: stencil,
      })
    );
  }
  for (const tpl of templates) {
    entries.push(
      createEntry({
        id: `tpl:${tpl.id}`,
        scope: 'library',
        kind: 'template',
        title: tpl.name,
        subtitle: tpl.category,
        keywords: `${tpl.description || ''} template diagram ${tpl.provider || ''}`,
        preview: tpl.description || '',
        data: tpl,
      })
    );
  }
  for (const page of pages) {
    const pageLabel = page.name || 'Page';
    const groups = new Map();
    for (const el of page.elements || []) {
      if (el.groupId) {
        if (!groups.has(el.groupId)) groups.set(el.groupId, []);
        groups.get(el.groupId).push(el);
      }
      const text = String(el.text || '').trim();
      if (!text) continue;
      entries.push(
        createEntry({
          id: `el:${page.id}:${el.id}`,
          scope: 'objects',
          kind: 'element',
          title: text.slice(0, 80),
          subtitle: `${pageLabel} · ${el.type}`,
          keywords: `${el.type} ${el.stencilId || ''} object element`,
          preview: text.slice(0, 160),
          visibility: el.private ? 'teacher' : 'shared',
          data: { pageId: page.id, elementId: el.id, active: page.id === activePageId },
        })
      );
      const notes = String(el.teacherNotes || '').trim();
      if (notes) {
        entries.push(
          createEntry({
            id: `note:${page.id}:${el.id}`,
            scope: 'lesson',
            kind: 'note',
            title: notes.slice(0, 80),
            subtitle: `${pageLabel} · teacher note`,
            keywords: `${text} lesson note teaching`,
            preview: notes.slice(0, 200),
            // Teacher notes stay local and are filtered out of student surfaces.
            visibility: 'teacher',
            data: { pageId: page.id, elementId: el.id },
          })
        );
      }
    }
    for (const [groupId, members] of groups) {
      const memberText = members
        .map((m) => String(m.text || '').trim())
        .filter(Boolean)
        .join(' ');
      // An unnamed group still needs a legible row; the raw id means nothing
      // to a teacher looking for "the web tier shapes".
      const title =
        members.find((m) => m.groupName)?.groupName || memberText || groupId;
      entries.push(
        createEntry({
          id: `group:${page.id}:${groupId}`,
          scope: 'objects',
          kind: 'group',
          title: String(title).slice(0, 80),
          subtitle: `${pageLabel} · ${members.length} object${members.length === 1 ? '' : 's'}`,
          keywords: `${memberText} group container selection`,
          preview: memberText.slice(0, 160),
          data: { pageId: page.id, groupId, elementIds: members.map((m) => m.id) },
        })
      );
    }
  }
  return entries;
}
