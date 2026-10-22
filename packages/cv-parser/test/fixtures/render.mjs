// Renders a persona into the inputs the parser receives in production:
// plain text, DOCX-style HTML, PDF text items (one and two columns) and OCR word boxes.

const FR_SKILL_TEXT = {
  Teamwork: 'Travail en équipe',
  'Project Management': 'Gestion de projet',
  Accounting: 'Comptabilité',
  Taxation: 'Fiscalité',
  Auditing: 'Audit',
  'Microsoft Excel': 'Excel',
  Creativity: 'Créativité',
  'UI/UX Design': 'UI/UX',
};
const FR_LANG = { English: 'Anglais', French: 'Français', Spanish: 'Espagnol', German: 'Allemand' };
const LEVELS_EN = ['(native)', '(fluent)', '(intermediate)'];
const LEVELS_FR = ['(langue maternelle)', '(courant)', '(notions)'];

const HEADINGS = {
  en: [
    { summary: 'PROFESSIONAL SUMMARY', experience: 'WORK EXPERIENCE', education: 'EDUCATION', skills: 'SKILLS', languages: 'LANGUAGES' },
    { summary: 'Profile', experience: 'Experience', education: 'Education', skills: 'Technical Skills', languages: 'Languages' },
    { summary: 'About Me', experience: 'Professional Experience', education: 'Academic Background', skills: 'Core Competencies', languages: 'Language Skills' },
  ],
  fr: [
    { summary: 'PROFIL', experience: 'EXPÉRIENCE PROFESSIONNELLE', education: 'FORMATION', skills: 'COMPÉTENCES', languages: 'LANGUES' },
    { summary: 'À propos', experience: 'Expériences professionnelles', education: 'Études', skills: 'Compétences techniques', languages: 'Langues' },
    { summary: 'Profil professionnel', experience: 'Parcours professionnel', education: 'Diplômes et formations', skills: 'Savoir-faire', languages: 'Langues parlées' },
  ],
};

export function skillText(p, skill) {
  return p.lang === 'fr' ? (FR_SKILL_TEXT[skill] ?? skill) : skill;
}

function langText(p, lang, i) {
  return p.lang === 'fr' ? `${FR_LANG[lang] ?? lang} ${LEVELS_FR[i % 3]}` : `${lang} ${LEVELS_EN[i % 3]}`;
}

function dateText(start, end) {
  return start ? `${start} – ${end}` : end;
}

function degreeLine(p, e) {
  if (!e.field) return e.degree;
  return `${e.degree} ${p.lang === 'fr' ? 'en' : 'in'} ${e.field}`;
}

/** Logical lines with layout hints; every renderer starts from these. */
export function logicalLines(p, variant) {
  const h = HEADINGS[p.lang][variant % 3];
  const out = [];
  const push = (text, opts = {}) => out.push({ text, ...opts });

  push(p.name, { role: 'name' });
  push(p.headline, { role: 'headline' });
  push([p.email, p.phone, p.location, ...p.links].join(' | '), { role: 'contact' });

  push(h.summary, { role: 'heading' });
  push(p.summary, { role: 'body' });

  push(h.experience, { role: 'heading' });
  for (const e of p.experience) {
    const dates = dateText(e.start, e.end);
    if (variant % 3 === 0) {
      push(`${e.title} | ${e.company}`, { role: 'entry', date: dates });
    } else if (variant % 3 === 1) {
      push(e.title, { role: 'entry' });
      push(`${e.company}, ${e.location}`, { role: 'sub' });
      push(dates, { role: 'sub' });
    } else {
      push(dates, { role: 'sub' });
      push(`${e.title} ${p.lang === 'fr' ? 'chez' : 'at'} ${e.company}`, { role: 'entry' });
    }
    for (const b of e.bullets) push(b, { role: 'bullet' });
  }

  push(h.education, { role: 'heading' });
  for (const e of p.education) {
    const dates = dateText(e.start, e.end);
    if (variant % 3 === 0) {
      push(degreeLine(p, e), { role: 'entry' });
      push(e.institution, { role: 'sub' });
      push(dates, { role: 'sub' });
    } else if (variant % 3 === 1) {
      push(`${degreeLine(p, e)}, ${e.institution}`, { role: 'entry', date: dates });
    } else {
      push(dates, { role: 'sub' });
      push(degreeLine(p, e), { role: 'entry' });
      push(e.institution, { role: 'sub' });
    }
  }

  push(h.skills, { role: 'heading' });
  const skills = p.skills.map((s) => skillText(p, s));
  const half = Math.ceil(skills.length / 2);
  push(skills.slice(0, half).join(', '), { role: 'skills' });
  push(skills.slice(half).join(variant % 2 ? ' • ' : ', '), { role: 'skills' });

  push(h.languages, { role: 'heading' });
  push(p.languages.map((l, i) => langText(p, l, i)).join(', '), { role: 'skills' });
  return out;
}

export function renderText(p, variant) {
  return logicalLines(p, variant)
    .map((l) => {
      if (l.role === 'bullet') return `${variant % 2 ? '-' : '•'} ${l.text}`;
      if (l.date) return `${l.text}   ${l.date}`;
      return l.text;
    })
    .join('\n');
}

export function renderHtml(p, variant) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let html = '';
  let inList = false;
  for (const l of logicalLines(p, variant)) {
    if (l.role !== 'bullet' && inList) {
      html += '</ul>';
      inList = false;
    }
    const text = esc(l.date ? `${l.text} (${l.date})` : l.text);
    if (l.role === 'name') html += `<p><strong>${text}</strong></p>`;
    else if (l.role === 'heading') html += `<h2>${text}</h2>`;
    else if (l.role === 'entry') html += `<p><strong>${text}</strong></p>`;
    else if (l.role === 'bullet') {
      if (!inList) html += '<ul>';
      inList = true;
      html += `<li>${text}</li>`;
    } else html += `<p>${text}</p>`;
  }
  return html + (inList ? '</ul>' : '');
}

const CHAR_WIDTH = 0.5;

function wrap(text, maxChars) {
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const SIZE = { name: 20, headline: 12, contact: 9.5, heading: 12, entry: 11, sub: 10, body: 10, bullet: 10, skills: 10 };

/** One-column PDF: right-aligned dates, bold titles, wrapped bullets with indented continuations. */
export function renderItems(p, variant) {
  const items = [];
  let y = 40;
  let page = 1;
  const left = 50;
  const right = 545;
  const add = (text, x, size, bold) => items.push({ text, x, y, width: text.length * size * CHAR_WIDTH, height: size, page, bold });

  for (const l of logicalLines(p, variant)) {
    const size = SIZE[l.role];
    const bold = ['name', 'heading', 'entry'].includes(l.role);
    if (l.role === 'heading') y += 8;
    const maxChars = Math.floor((right - left) / (size * CHAR_WIDTH)) - (l.date ? l.date.length + 4 : 0);
    const text = l.role === 'heading' && variant % 3 !== 1 ? l.text.toUpperCase() : l.text;
    const wrapped = l.role === 'bullet' ? wrap(`• ${text}`, maxChars - 4) : wrap(text, maxChars);
    wrapped.forEach((chunk, i) => {
      add(chunk, i > 0 && l.role === 'bullet' ? left + 12 : left, size, bold);
      if (i === 0 && l.date) add(l.date, right - l.date.length * size * CHAR_WIDTH, size, false);
      y += size * 1.45;
    });
    if (y > 780) {
      page += 1;
      y = 40;
    }
  }
  return items;
}

/** Sidebar layout: contact, skills and languages on the left; the rest on the right. */
export function renderTwoColumn(p, variant) {
  const items = [];
  const lines = logicalLines(p, variant);
  const sideRoles = new Set(['contact']);
  let section = '';
  const side = [];
  const main = [];
  for (const l of lines) {
    if (l.role === 'heading') section = l.text;
    const h = HEADINGS[p.lang][variant % 3];
    const sidebar = sideRoles.has(l.role) || section === h.skills || section === h.languages;
    (sidebar ? side : main).push(l);
  }

  const place = (list, left, width, startY) => {
    let y = startY;
    for (const l of list) {
      const size = SIZE[l.role];
      if (l.role === 'heading') y += 8;
      const maxChars = Math.floor(width / (size * CHAR_WIDTH));
      const parts = l.role === 'contact' ? l.text.split(' | ') : l.role === 'skills' ? l.text.split(/, | • /) : [l.text];
      for (const part of parts) {
        const text = l.role === 'bullet' ? `• ${part}` : part;
        for (const [i, chunk] of wrap(text, maxChars).entries()) {
          items.push({ text: chunk, x: i > 0 && l.role === 'bullet' ? left + 10 : left, y, width: chunk.length * size * CHAR_WIDTH, height: size, page: 1, bold: ['name', 'heading', 'entry'].includes(l.role) });
          y += size * 1.45;
        }
        if (l.date) {
          items.push({ text: l.date, x: left, y, width: l.date.length * size * CHAR_WIDTH, height: size, page: 1, bold: false });
          y += size * 1.45;
        }
      }
    }
  };
  place(main.slice(0, 2), 220, 330, 40);
  place(side, 40, 150, 100);
  place(main.slice(2), 220, 330, 100);
  return items;
}

/** OCR: word boxes, no bold, small jitter, bullets misread, one heading with a letter error. */
export function renderOcr(p, variant) {
  const words = [];
  let seed = p.id.length * 7 + variant;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let typoDone = false;
  for (const item of renderItems(p, variant)) {
    let x = item.x;
    let text = item.text.replace(/^• /, variant % 2 ? '' : 'e ');
    if (!typoDone && /^[A-ZÉ ]{8,}$/.test(text) && text.includes('E')) {
      text = text.replace(/E(?=[^E]*$)/, 'F');
      typoDone = true;
    }
    for (const word of text.split(' ').filter(Boolean)) {
      const width = word.length * item.height * CHAR_WIDTH;
      // Real OCR boxes hug the ink: a dash or bullet is a thin box in the middle of the line.
      const glyph = /^[-–—•·]$/.test(word);
      const height = glyph ? Math.max(1, item.height * 0.15) : item.height;
      const top = glyph ? item.y + item.height * 0.45 : item.y + (rand() - 0.5) * 2;
      words.push({ text: word, x, y: top, width, height, page: item.page });
      x += width + item.height * CHAR_WIDTH;
    }
  }
  return words;
}

export const RENDERERS = {
  text: (p, v) => ({ kind: 'text', text: renderText(p, v) }),
  html: (p, v) => ({ kind: 'html', html: renderHtml(p, v) }),
  pdf: (p, v) => ({ kind: 'items', items: renderItems(p, v) }),
  'pdf-2col': (p, v) => ({ kind: 'items', items: renderTwoColumn(p, v) }),
  ocr: (p, v) => ({ kind: 'items', items: renderOcr(p, v) }),
};
