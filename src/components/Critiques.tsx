import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Eye, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { CRITIQUES_HASH_ID, CRITIQUES_LABEL, CRITIQUES_URL_PREFIX } from "@/lib/resourceSection";

/** Cartes Critiques (racines). Sous-catégories imbriquées : Sanity, référence parent (même section). */
const categories = [
  {
    id: "critiques-litteraires",
    title: "Critiques de livres d'art",
    description: "Articles et commentaires sur les livres d'art récents",
    icon: <BookOpen className="w-8 h-8" />,
    href: `/${CRITIQUES_URL_PREFIX}/critiques-livres-d-art`,
  },
  {
    id: "oeil-expo",
    title: "Expositions à voir",
    description: "Articles sur les expositions récentes",
    icon: <Eye className="w-8 h-8" />,
    href: `/${CRITIQUES_URL_PREFIX}/oeil-expo`,
  },
] as const;

export default function Critiques() {
  return (
    <section id={CRITIQUES_HASH_ID} className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl sm:text-5xl font-bold mb-4">{CRITIQUES_LABEL}</h2>
          <p className="text-gray-medium max-w-2xl mx-auto">
            Regards critiques sur l'art, les livres et les expositions
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((category) => (
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
