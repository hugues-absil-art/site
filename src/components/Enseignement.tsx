import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { GraduationCap, Palette, Users, ArrowRight, CalendarDays } from "lucide-react";
import Card from "@/components/ui/Card";

interface EnseignementCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  featured?: boolean;
}

/** Cartes Enseignement (racines). Les sous-niveaux et sous-sous-catégories se gèrent dans Sanity (référence parent). */
const categories: EnseignementCategory[] = [
  {
    id: "atelier-stages",
    title: "Ateliers & Stages",
    description: "Stages de peinture, cours en atelier et formations pratiques",
    icon: <Users className="w-8 h-8" />,
    href: "/enseignement/atelier-stages",
    featured: true,
  },
  {
    id: "histoire-art",
    title: "Histoire de l'art",
    description: "Cours et contenus théoriques",
    icon: <GraduationCap className="w-8 h-8" />,
    href: "/enseignement/histoire-art",
  },
  {
    id: "technique-picturale",
    title: "Technique de création",
    description: "Cours sur les matériaux et techniques",
    icon: <Palette className="w-8 h-8" />,
    href: "/enseignement/technique-picturale",
  },
];

export default function Enseignement() {
  const featuredCategory = categories.find((c) => c.featured);
  const otherCategories = categories.filter((c) => !c.featured);

  return (
    <section id="enseignement" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl sm:text-5xl font-bold mb-4">Enseignement</h2>
          <p className="text-gray-medium max-w-2xl mx-auto">
            Cours, technique et ateliers de peinture
          </p>
        </motion.div>

        {/* Ateliers & Stages — carte mise en avant, pleine largeur */}
        {featuredCategory && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-8"
          >
            <Link to={featuredCategory.href}>
              <Card className="p-8 hover:shadow-lg transition-shadow group border-2 border-foreground/10 bg-gray-50">
                <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                  <div className="flex items-center justify-center w-16 h-16 rounded-full bg-foreground/5 text-foreground group-hover:scale-110 transition-transform shrink-0">
                    {featuredCategory.icon}
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                      <h3 className="font-serif text-2xl font-semibold group-hover:opacity-80 transition-opacity">
                        {featuredCategory.title}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-foreground text-background rounded-full">
                        <CalendarDays className="w-3 h-3" />
                        Prochaines dates
                      </span>
                    </div>
                    <p className="text-gray-medium mb-4">{featuredCategory.description}</p>
                    <div className="inline-flex items-center text-sm font-medium text-foreground group-hover:translate-x-1 transition-transform">
                      Voir les ateliers & stages
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        )}

        {/* Autres catégories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {otherCategories.map((category) => (
              <Link key={category.id} to={category.href}>
                <Card className="p-8 h-full hover:shadow-lg transition-shadow group">
                  <div className="flex items-start gap-4">
                    <div className="text-foreground group-hover:scale-110 transition-transform">
                      {category.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-serif text-xl font-semibold mb-2 group-hover:opacity-80 transition-opacity">
                        {category.title}
                      </h4>
                      <p className="text-sm text-gray-medium mb-4">{category.description}</p>
                      <div className="inline-flex items-center text-sm text-foreground group-hover:translate-x-1 transition-transform">
                        Découvrir
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
