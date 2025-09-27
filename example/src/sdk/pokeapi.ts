import "server-only";

export type Pokemon = {
  name: string;
  dexNumber: number;
};

export type PokemonPair = [Pokemon, Pokemon];

/**
 * Fetches all Pokemon from Gen 1-9 (up to #1025) from the PokeAPI GraphQL endpoint.
 * No caching, so this happens on every request (slower).
 */
export async function getAllPokemon() {
  // Removed "use cache" and unstable_cacheLife for fresh fetch every time

  const query = `
    query GetAllPokemon {
      pokemon_v2_pokemon(where: {id: {_lte: 1025}}) {
        id
        pokemon_v2_pokemonspecy {
          name
        }
      }
    }
  `;

  const response = await fetch("https://beta.pokeapi.co/graphql/v1beta", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = (await response.json()).data as {
    pokemon_v2_pokemon: {
      id: number;
      pokemon_v2_pokemonspecy: {
        name: string;
      };
    }[];
  };

  return data.pokemon_v2_pokemon.map((pokemon) => ({
    name: pokemon.pokemon_v2_pokemonspecy.name,
    dexNumber: pokemon.id,
  }));
}

import { connection } from "next/server";

export async function getTwoRandomPokemon() {
  await connection(); // dynamic, runs fresh every time

  const allPokemon = await getAllPokemon();
  const shuffled = allPokemon.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 2);
}
