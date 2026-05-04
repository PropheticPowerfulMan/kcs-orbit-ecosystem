import React from "react";
import { createRoot } from "react-dom/client";
import { Bath, BedDouble, Heart, MapPin, Menu, Move, ShieldCheck, Timer, UserCheck } from "lucide-react";
import "./styles.css";

const properties = [
  {
    id: 1,
    badge: "Nouveau",
    title: "Penthouse panoramique",
    price: "1 250 000 €",
    address: "Avenue Victor Hugo, Paris 16e",
    beds: 4,
    baths: 3,
    area: 215,
    image:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 2,
    badge: "Location",
    title: "Loft lumineux",
    price: "3 400 €/mois",
    address: "Rue de la République, Lyon",
    beds: 2,
    baths: 2,
    area: 115,
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 3,
    badge: "Nouveau",
    title: "Villa contemporaine",
    price: "2 890 000 €",
    address: "Corniche Kennedy, Marseille",
    beds: 5,
    baths: 4,
    area: 340,
    image:
      "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: 4,
    badge: "Location",
    title: "Appartement design",
    price: "2 150 €/mois",
    address: "Place du Capitole, Toulouse",
    beds: 3,
    baths: 2,
    area: 98,
    image:
      "https://images.unsplash.com/photo-1600566753051-f0b8f03e9f09?auto=format&fit=crop&w=1400&q=80",
  },
];

const services = [
  {
    icon: UserCheck,
    title: "Expertise",
    desc: "Une équipe locale premium pour vous guider à chaque étape de votre projet immobilier.",
  },
  {
    icon: Timer,
    title: "Rapidité",
    desc: "Des estimations et des rendez-vous organisés en un temps record grâce à nos outils intelligents.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    desc: "Transactions vérifiées, accompagnement juridique et process transparents pour votre sérénité.",
  },
];

function App() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="bg-ivory text-night min-h-screen antialiased">
      <header className={`fixed inset-x-0 top-0 z-30 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-sm" : "bg-transparent"}`}>
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <span className="text-xl font-extrabold tracking-tight">Élite Immo</span>

          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Ouvrir le menu">
            <Menu />
          </button>

          <ul className={`absolute left-0 right-0 top-full border-b border-slate-200 bg-white px-6 py-4 md:static md:flex md:items-center md:gap-8 md:border-none md:bg-transparent md:p-0 ${open ? "block" : "hidden md:flex"}`}>
            {['Acheter', 'Louer', 'Vendre', 'Estimer'].map((link) => (
              <li key={link}>
                <a className="font-medium text-slate-700 transition hover:text-royal" href="#">
                  {link}
                </a>
              </li>
            ))}
            <li className="mt-4 md:mt-0 md:ml-4">
              <button className="w-full rounded-full bg-royal px-5 py-2.5 font-semibold text-white transition hover:bg-night md:w-auto">
                Connexion
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <main>
        <section
          className="relative flex min-h-[92vh] items-center justify-center bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(rgba(12,16,25,.55), rgba(12,16,25,.55)), url('https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1800&q=80')",
          }}
        >
          <div className="mx-auto w-full max-w-5xl px-4 text-center text-white md:px-8">
            <p className="mb-4 inline-block rounded-full border border-white/30 bg-white/10 px-4 py-1 text-sm">Immobilier premium en France</p>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
              Trouvez le lieu parfait pour votre prochain chapitre.
            </h1>

            <div className="mt-10 rounded-2xl border border-white/20 bg-white/95 p-4 text-night shadow-soft backdrop-blur-md md:p-5">
              <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
                <label className="field">
                  <MapPin size={18} className="text-royal" />
                  <input type="text" placeholder="Lieu" />
                </label>
                <label className="field">
                  <Move size={18} className="text-royal" />
                  <select defaultValue="">
                    <option value="" disabled>Type de bien</option>
                    <option>Appartement</option>
                    <option>Maison</option>
                    <option>Villa</option>
                    <option>Loft</option>
                  </select>
                </label>
                <label className="field">
                  <span className="text-royal font-bold">€</span>
                  <select defaultValue="">
                    <option value="" disabled>Budget</option>
                    <option>0 € - 250 000 €</option>
                    <option>250 000 € - 750 000 €</option>
                    <option>750 000 € - 1 500 000 €</option>
                    <option>1 500 000 € +</option>
                  </select>
                </label>
                <button className="rounded-xl bg-royal px-6 py-3 font-semibold text-white transition hover:bg-night">Rechercher</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 md:px-8">
          <div className="mb-10 flex items-center justify-between">
            <h2 className="text-3xl font-bold md:text-4xl">Propriétés à la une</h2>
            <a href="#" className="font-semibold text-royal hover:text-night">Voir tout</a>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {properties.map((property) => (
              <article key={property.id} className="group overflow-hidden rounded-2xl bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative">
                  <img src={property.image} alt={property.title} className="h-52 w-full object-cover" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-night">
                    {property.badge}
                  </span>
                  <button className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-600 transition hover:text-rose-500" aria-label={`Ajouter ${property.title} aux favoris`}>
                    <Heart size={18} />
                  </button>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-2xl font-extrabold text-night">{property.price}</p>
                  <h3 className="font-semibold">{property.title}</h3>
                  <p className="text-sm text-slate-500">{property.address}</p>
                  <div className="flex items-center gap-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1"><BedDouble size={16} /> {property.beds}</span>
                    <span className="inline-flex items-center gap-1"><Bath size={16} /> {property.baths}</span>
                    <span className="inline-flex items-center gap-1"><Move size={16} /> {property.area} m²</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 md:grid-cols-3 md:px-8">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.title} className="rounded-2xl border border-slate-100 p-7 transition hover:border-royal/40 hover:shadow-soft">
                  <div className="mb-4 inline-flex rounded-xl bg-royal/10 p-3 text-royal">
                    <Icon />
                  </div>
                  <h3 className="mb-2 text-xl font-bold">{service.title}</h3>
                  <p className="text-slate-600">{service.desc}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="bg-night py-12 text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-xl font-bold text-white">Élite Immo</p>
            <p className="mt-2 text-sm text-slate-400">Votre partenaire immobilier d'exception.</p>
          </div>
          <ul className="flex flex-wrap gap-6 text-sm">
            <li><a className="transition hover:text-white" href="#">Acheter</a></li>
            <li><a className="transition hover:text-white" href="#">Louer</a></li>
            <li><a className="transition hover:text-white" href="#">Vendre</a></li>
            <li><a className="transition hover:text-white" href="#">Estimer</a></li>
          </ul>
          <ul className="flex gap-4 text-sm">
            <li><a className="transition hover:text-white" href="#">Instagram</a></li>
            <li><a className="transition hover:text-white" href="#">LinkedIn</a></li>
            <li><a className="transition hover:text-white" href="#">X</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
