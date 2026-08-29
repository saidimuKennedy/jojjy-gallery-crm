import Head from "next/head";
import DashboardLayout from "@/components/DashboardLayout";
import SeriesManagement from "@/components/Admin/SeriesManagement";

export default function SeriesPage() {
  return (
    <DashboardLayout>
      <Head>
        <title>Series — Jojjy Gallery CRM</title>
      </Head>
      <SeriesManagement />
    </DashboardLayout>
  );
}
