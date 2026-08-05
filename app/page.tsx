import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import VerticalsTable from "@/components/VerticalsTable";
import DeliveryFlow from "@/components/DeliveryFlow";
import Reporting from "@/components/Reporting";
import Audiences from "@/components/Audiences";
import Compliance from "@/components/Compliance";
import Services from "@/components/Services";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VerticalsTable />
        <DeliveryFlow />
        <Reporting />
        <Audiences />
        <Compliance />
        <Services />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
