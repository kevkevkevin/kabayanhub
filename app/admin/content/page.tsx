import ContentManager from "../components/ContentManager";

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = await searchParams;
  const tab = section === "marketplace" || section === "purchases" ? section : "videos";
  return <ContentManager key={tab} initialTab={tab} />;
}
