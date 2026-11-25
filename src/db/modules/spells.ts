import { LATIN_SPELLS, type Spell } from '../../data/spells';
import { queryAll, queryRun } from '../core';

export type { Spell };

export async function getSpellsFromDb(): Promise<Spell[]> {
  const spells = await queryAll<Spell>('SELECT * FROM spells ORDER BY unlocklevel ASC, name ASC');
  return spells.map(s => ({
    ...s,
    isForbidden: Boolean(s.isForbidden)
  }));
}

export async function saveSpellToDb(spell: Spell) {
  await queryRun(
    `INSERT INTO spells (
      id, name, translation, category, incantation, elementaltype, description, targetrealitylayer, basepower, manacost, cooldownseconds, requiredessences, icon, color, isforbidden, rarity, unlocklevel
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      translation = EXCLUDED.translation,
      category = EXCLUDED.category,
      incantation = EXCLUDED.incantation,
      elementaltype = EXCLUDED.elementaltype,
      description = EXCLUDED.description,
      targetrealitylayer = EXCLUDED.targetrealitylayer,
      basepower = EXCLUDED.basepower,
      manacost = EXCLUDED.manacost,
      cooldownseconds = EXCLUDED.cooldownseconds,
      requiredessences = EXCLUDED.requiredessences,
      icon = EXCLUDED.icon,
      color = EXCLUDED.color,
      isforbidden = EXCLUDED.isforbidden,
      rarity = EXCLUDED.rarity,
      unlocklevel = EXCLUDED.unlocklevel`,
    [
      spell.id,
      spell.name,
      spell.translation || spell.name,
      spell.category || 'Стихии',
      spell.incantation || `Forma ${spell.name}!`,
      spell.elementalType || 'Магия',
      spell.description || '',
      spell.targetRealityLayer ?? 1,
      spell.basePower ?? 50,
      spell.manaCost ?? 10,
      spell.cooldownSeconds ?? 5,
      JSON.stringify(spell.requiredEssences || []),
      spell.icon || '✨',
      spell.color || '#c9a343',
      spell.isForbidden ? 1 : 0,
      spell.rarity || 'Обычное',
      spell.unlockLevel ?? 1
    ]
  );
}

export async function deleteSpellFromDb(id: string) {
  await queryRun('DELETE FROM spells WHERE id = $1', [id]);
}

export async function resetSpellsInDb(): Promise<Spell[]> {
  await queryRun('DELETE FROM spells');
  for (const s of LATIN_SPELLS) {
    await saveSpellToDb(s);
  }
  return getSpellsFromDb();
}
