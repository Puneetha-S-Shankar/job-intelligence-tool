import "dotenv/config";
import { supabase } from "./supabase";
import { GCC_SEED_COMPANIES } from "../data/gccCompanies";

console.log("Total companies in file:", GCC_SEED_COMPANIES.length);
export async function seedCompanies() {
  const { data: university } = await supabase
    .from("universities")
    .select("id")
    .eq("name", "RV University")
    .single();

  if (!university) {
    console.error("[SEED] University not found. Run seed.ts first.");
    return;
  }

  const rows = GCC_SEED_COMPANIES.map(c => ({
    name: c.name,
    careers_url: c.careersUrl,
    tier: c.tier,
    is_gcc: c.isGcc,
    city: "Bangalore",
    discovered_from: "seed",
    scrape_enabled: true,
    university_id: university.id,
  }));

  const { error } = await supabase
    .from("companies")
    .upsert(rows, { onConflict: "name" });

  if (error) console.error("[SEED] Companies seed failed:", error.message);
  else console.log(`[SEED] ${rows.length} companies seeded into companies table`);
}


seedCompanies().then(() => process.exit(0));
