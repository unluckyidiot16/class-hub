// src/games/quizmon/abilityData.ts
import abilitiesJson from "./data/abilities.json";
import type { Ability, AbilityMeta, ElementType } from "./types";

type RawAbilityRow = {
    id: string;
    name?: string;
    nameKo?: string;
    description?: string;
    descriptionKo?: string;
    element?: ElementType | null | string;
    meta?: AbilityMeta;
};

export type AbilityEntity = Ability & {
    element: ElementType | null;
};

export const ABILITY_DB: Record<string, AbilityEntity> = {};

for (const raw of abilitiesJson as RawAbilityRow[]) {
    const element =
        raw.element === null || raw.element === undefined
            ? null
            : (raw.element as ElementType);

    ABILITY_DB[raw.id] = {
        id: raw.id,
        name: raw.nameKo || raw.name || raw.id,
        description: raw.descriptionKo || raw.description || "",
        element,
        meta: raw.meta,
    };
}
