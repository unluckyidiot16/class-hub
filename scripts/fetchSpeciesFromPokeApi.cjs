/* eslint-disable no-console */
const fs = require("fs/promises");
const path = require("path");

const BASE = "https://pokeapi.co/api/v2";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch 실패: ${url} (${res.status})`);
  }
  return res.json();
}

// PokeAPI 타입 → 우리 element 매핑 (MVP에서는 5개 타입만 사용)
const ELEMENT_MAP = {
  normal: "normal",
  fire: "fire",
  water: "water",
  grass: "grass",
  electric: "electric",
};

function mapPrimaryElement(pokemon) {
  const firstType = pokemon.types[0]?.type?.name;
  return ELEMENT_MAP[firstType] || "normal";
}

function pickLocalizedName(names, lang) {
  return (
    names.find((n) => n.language?.name === lang)?.name ||
    null
  );
}

function pickFlavorText(entries) {
  const ko =
    entries.find((e) => e.language?.name === "ko") ||
    null;
  const en =
    entries.find((e) => e.language?.name === "en") ||
    null;

  const raw = (ko || en)?.flavor_text || "";
  return raw.replace(/\f/g, " ").replace(/\s+/g, " ").trim();
}

function extractBaseStats(pokemon) {
  const out = {};
  for (const s of pokemon.stats) {
    const name = s.stat?.name;
    switch (name) {
      case "hp":
        out.hp = s.base_stat;
        break;
      case "attack":
        out.atk = s.base_stat;
        break;
      case "defense":
        out.def = s.base_stat;
        break;
      case "special-attack":
        out.spAtk = s.base_stat;
        break;
      case "special-defense":
        out.spDef = s.base_stat;
        break;
      case "speed":
        out.spd = s.base_stat;
        break;
    }
  }
  return out;
}

async function fetchSpeciesEntry(nameOrId) {
  const [pokemon, species] = await Promise.all([
    fetchJson(`${BASE}/pokemon/${nameOrId}`),
    fetchJson(`${BASE}/pokemon-species/${nameOrId}`),
  ]);

  const pokedexNo = pokemon.id;
  const id = `poke-${String(pokedexNo).padStart(4, "0")}`;

  const nameKo = pickLocalizedName(species.names, "ko") || species.name;
  const nameEn = pickLocalizedName(species.names, "en") || species.name;

  const baseStats = extractBaseStats(pokemon);
  const element = mapPrimaryElement(pokemon);
  const flavorText = pickFlavorText(species.flavor_text_entries);

  return {
    id,
    pokedexNo,
    name: nameKo,
    nameEn,
    element,
    rarity: 1,

    baseStats,

    heightDm: pokemon.height, // dm
    weightHg: pokemon.weight, // hg

    spriteKey: String(pokedexNo).padStart(4, "0"),
    description: flavorText,

    // evolution 정보는 나중 단계에서 채우거나 수동 입력
    evolution: null,
  };
}

async function main() {
  // 🔧 여기 리스트만 바꾸면 됨
  const pokemonList = ["bulbasaur", "charmander", "squirtle"];

  const entries = [];
  for (const name of pokemonList) {
    console.log(`[PokeAPI] 종 데이터 가져오는 중: ${name}`);
    const entry = await fetchSpeciesEntry(name);
    entries.push(entry);
  }

  const dataDir = path.resolve(
    __dirname,
    "../src/games/quizmon/data",
  );
  await fs.mkdir(dataDir, { recursive: true });

  const outPath = path.join(dataDir, "species.json");

  // ⚠️ 기존 species.json을 덮어쓰므로, 필요하면 먼저 백업해두세요.
  await fs.writeFile(outPath, JSON.stringify(entries, null, 2), "utf8");

  console.log("=== PokeAPI species 덤프 완료 ===");
  console.log("→", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
