function toTitleCase(str) {
  if (str == null) {
    return '';
  }
  return str
    .trim()
    .toLowerCase()
    .replace(/\b\w\S*/g, (match) => {
      if (match === 'of' || match === 'the') {
        return match;
      }
      if (['i', 'ii', 'iii', 'iv', 'v'].includes(match)) {
        return match.toUpperCase();
      }
      return match[0].toUpperCase() + match.slice(1);
    });
}

function toDisplayName(row) {
  return toTitleCase(row.name ?? row.id);
}

const symbolMap = new Map([
  ['skills', '📔'],
  ['spells', '☄'],
]);

function toDisplaySymbol(row) {
  const res = symbolMap.get(row.meta.type);
  return res == null ? '' : res + ' ';
}

function findMatches(query, data, limit) {
  query = query.toLowerCase();
  const results = [];
  for (const row of data) {
    if (
      row.id.includes(query) ||
      (row?.name != null && row.name.toLowerCase().includes(query))
    ) {
      results.push(row);
      if (results.length >= limit) {
        break;
      }
    }
  }
  return results;
}

function findById(id, data) {
  for (const row of data) {
    if (row.id === id) {
      return row;
    }
  }
  return null;
}

const resourceMap = new Map([
  ['sp', 'skill_points'],
  ['gems', 'gemstones'],
  ['bloodgem', 'blood_gem'],
  ['managem', 'arcane_gem'],
  ['watergem', 'water_gem'],
  ['airgem', 'air_gem'],
  ['firegem', 'fire_gem'],
  ['earthgem', 'earth_gem'],
  ['naturegem', 'nature_gem'],
  ['spiritgem', 'spirit_gem'],
  ['lightgem', 'light_gem'],
  ['shadowgem', 'shadow_gem'],
  ['chaosgem', 'chaos_gem'],
  ['voidgem', 'void_gem'],
  ['runestones', 'rune_stones'],
  ['waterrune', 'water_runes'],
  ['airrune', 'air_runes'],
  ['firerune', 'flame_runes'],
  ['earthrune', 'earth_runes'],
  ['chaosrune', 'chaos_runes'],
  ['hp', 'life'],
  ['bonedust', 'bone_dust'],
]);

function resourceToWikiKey(res) {
  return resourceMap.get(res) ?? res;
}

const improveMap = new Map([
  ['attack.damage.min', 'Damage Min'],
  ['attack.dot.damage.min', 'Damage Min'],
  ['attack.damage.max', 'Damage Max'],
  ['attack.dot.damage.max', 'Damage Max'],
  ['attack.tohit', 'Hit Bonus'],
]);

function improveToWikiLabel(str) {
  return improveMap.get(str) ?? str;
}

function guessSpellTarget(spell) {
  if (spell?.attack?.targets === 'enemies') {
    return 'Enemies';
  }
  if (spell?.attack?.targets === 'allies') {
    return 'Allies';
  }
  if (spell?.summon != null) {
    return 'Ally';
  }
  if (
    spell?.keywords?.target?.length === 1 &&
    spell.keywords.target[0] === 'self'
  ) {
    return 'Self';
  }
  return 'Single';
}

function renderSpellWikiText(spell, data) {
  let output = `{{spell infobox\n| school = ${toTitleCase(spell.school)}`;
  output += `\n| level = ${spell.level}`;
  if (spell.cd != null) {
    output += `\n| cd = ${spell.cd}`;
  }
  let buyArcana = spell.level - 1;
  if (spell.buy != null) {
    for (const [key, value] of Object.entries(spell.buy)) {
      if (key === 'arcana') {
        buyArcana = value;
      } else {
        output += `\n| purchase_${resourceToWikiKey(key)} = ${value}`;
      }
    }
  }
  if (buyArcana > 0) {
    output += `\n| purchase_arcana = ${buyArcana}`;
  }
  for (const [key, value] of Object.entries(spell.cost)) {
    output += `\n| cast_${resourceToWikiKey(key)} = ${value}`;
  }
  if (spell?.attack?.tohit != null) {
    output += `\n| hit_bonus = ${spell.attack.tohit}`;
  }
  output += `\n| target = ${guessSpellTarget(spell)}`;
  if (spell?.attack?.damage != null) {
    output += `\n| damage = ${spell.attack.damage.replace('~', '-')} ${toTitleCase(spell.attack.kind)}`;
  }
  if (spell?.attack?.dot?.damage != null) {
    output += `\n| dot = ${spell.attack.dot.damage.toString().replace('~', '-')}/s ${toTitleCase(spell.attack.dot.kind)} for ${spell.attack.dot.duration}s`;
  }
  if (spell?.dot?.healing != null) {
    output += `\n| healing = ${spell.dot.healing}/s for ${spell.dot.duration}s`;
  } else if (spell?.attack?.healing != null) {
    output += `\n| healing = ${spell.attack.healing}`;
  }
  if (spell?.summon != null) {
    const summons = [];
    for (const row of spell.summon) {
      const summon = findById(row.id, data.monsters);
      summons.push(
        `${row.count ?? 1} ${toDisplayName(summon)} (max ${row.max ?? '∞'})`,
      );
    }
    output += `\n| summon = ${summons.join('<br>')}`;
  }
  if (spell?.result != null) {
    for (const [key, value] of Object.entries(spell.result)) {
      if (!key.endsWith('.exp')) {
        continue;
      }
      const skill = findById(key.slice(0, -4), data.skills);
      if (skill != null) {
        output += `\n| [[${toDisplayName(skill)}]] Exp|${value}`;
      }
    }
  }
  output += '\n}}';

  const descriptions = [];
  if (spell?.desc != null) {
    descriptions.push(spell.desc);
  }
  if (spell?.flavor != null) {
    descriptions.push(`''${spell.flavor}''`);
  }
  if (descriptions.length > 0) {
    output += `\n\n<blockquote>\n${descriptions.join('\n\n')}\n</blockquote>`;
  }

  output += '\n\n== Requirements ==';
  output += `\nrequire: ${spell.require}`;
  if (spell?.need != null) {
    output += `\nneed: ${spell.need}`;
  }

  if (spell?.at != null) {
    output +=
      '\n\n== Improvements ==\n{| class="wikitable"\n! Cast Count !! Effects';
    for (const [threshold, mods] of Object.entries(spell.at)) {
      output += `\n|-\n|${threshold}\n|`;
      for (const [key, value] of Object.entries(mods)) {
        output += `\n* ${improveToWikiLabel(key)}: ${value}`;
      }
    }
    output += '\n|}';
  }

  if (spell?.summon != null) {
    const summons = [];
    for (const row of spell.summon) {
      const summon = findById(row.id, data.monsters);
      summons.push(
        `\n=== ${toDisplayName(summon)} ===\n<blockquote>\nTODO\n</blockquote>`,
      );
    }
    output += `\n\n== Summoned Ally ==${summons.join('\n')}`;
  }
  return output;
}

async function main() {
  const apiBase = 'https://mathiashjelm.gitlab.io/arcanum/data/';

  const dataTypes = ['monsters', 'skills', 'spells'];
  const data = {};
  for (const field of dataTypes) {
    const response = await fetch(`${apiBase}${field}.json`);
    data[field] = await response.json();
    data[field].forEach(
      (row, idx, arr) =>
        (arr[idx].meta = { source: `${field}.json`, type: field }),
    );
  }

  let response = await fetch(apiBase + 'modules.json');
  const moduleList = await response.json();
  for (const modName of moduleList.modules) {
    const modSource = `modules/${modName}.json`;
    response = await fetch(apiBase + modSource);
    const modData = await response.json();
    for (const field of dataTypes) {
      if (modData?.data?.[field] != null) {
        for (const row of modData.data[field]) {
          data[field].push({
            ...row,
            meta: { source: modSource, type: field },
          });
        }
      }
    }
  }

  const inputQuery = document.getElementById('query');
  const ulMatches = document.getElementById('matches');
  const preData = document.getElementById('data');
  const aLink = document.getElementById('link');
  const preWiki = document.getElementById('wiki');

  const onResultClick = (row) => {
    inputQuery.value = row.id;
    preData.textContent = JSON.stringify(row, null, 2);
    if (row?.summon != null) {
      for (const summonRow of row.summon) {
        const summon = findById(summonRow.id, data.monsters);
        preData.textContent += '\n\n' + JSON.stringify(summon, null, 2);
      }
    }
    const displayName = toDisplayName(row);
    aLink.href =
      'https://theoryofmagic.miraheze.org/wiki/' +
      displayName.replaceAll(' ', '_');
    aLink.textContent = displayName;
    if (row.meta.type === 'skills') {
      preWiki.textContent = 'TODO: Skill';
    } else if (row.meta.type === 'spells') {
      preWiki.textContent = renderSpellWikiText(row, data);
    }
  };

  const searchData = data.skills.concat(data.spells);

  inputQuery.addEventListener('input', (e) => {
    const matches = findMatches(e.target.value, searchData, 10);
    const matchRows = [];
    for (const match of matches) {
      const row = document.createElement('li');
      row.textContent =
        toDisplaySymbol(match) + toDisplayName(match) + ` (${match.id})`;
      row.addEventListener('click', () => onResultClick(match));
      matchRows.push(row);
    }
    ulMatches.replaceChildren(...matchRows);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => main());
} else {
  main();
}
