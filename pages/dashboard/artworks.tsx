import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import ArtworkManagement from "@/components/Admin/ArtworkManagement";

export default function ArtworksPage() {
  return (
    <DashboardLayout>
      <Head>
        <title>Artworks — Jojjy Gallery CRM</title>
      </Head>
      <ArtworkManagement />
    </DashboardLayout>
  );
}
