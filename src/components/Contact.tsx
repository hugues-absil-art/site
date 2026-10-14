import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Instagram, Linkedin } from "lucide-react";
import emailjs from "@emailjs/browser";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import type { SiteSettings } from "@/lib/sanity/data";
import { realProfileUrl } from "@/lib/seo";

interface ContactProps {
  siteSettings?: SiteSettings | null;
}

export default function Contact({ siteSettings }: ContactProps) {
  const contactTitle = siteSettings?.contactTitle ?? "Contact";
  const contactIntro = siteSettings?.contactIntro ?? "Pour toute question, demande d'information ou intérêt pour une œuvre";
  const contactInfoTitle = siteSettings?.contactInfoTitle ?? "Informations";
  const contactInfoText = siteSettings?.contactInfoText ?? "N'hésitez pas à me contacter pour toute demande concernant mes œuvres, les expositions à venir ou pour organiser une visite de l'atelier.";
  const instagramUrl = realProfileUrl(siteSettings?.instagramUrl);
  const linkedinUrl = realProfileUrl(siteSettings?.linkedinUrl);
  const contactSuccessMessage = siteSettings?.contactSuccessMessage ?? "Message envoyé avec succès ! Je vous répondrai dans les plus brefs délais.";
  const contactErrorMessage = siteSettings?.contactErrorMessage ?? "Une erreur est survenue. Veuillez réessayer.";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    try {
      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        {
          from_name: formData.name,
          from_email: formData.email,
          subject: formData.subject,
          message: formData.message,
        },
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );
      setSubmitStatus("success");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      console.error("Erreur EmailJS :", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus("idle"), 5000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="container mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-serif text-4xl sm:text-5xl font-bold mb-4">{contactTitle}</h2>
          <p className="text-gray-medium max-w-2xl mx-auto">
            {contactIntro}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div>
              <h3 className="font-serif text-2xl font-semibold mb-4">{contactInfoTitle}</h3>
              <p className="text-gray-medium mb-6">
                {contactInfoText}
              </p>
            </div>
            {(instagramUrl || linkedinUrl) && (
              <div>
                <h4 className="font-semibold mb-3">Réseaux Sociaux</h4>
                <div className="flex space-x-4">
                  {instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-medium hover:text-foreground transition-colors" aria-label="Instagram">
                      <Instagram className="w-6 h-6" />
                    </a>
                  )}
                  {linkedinUrl && (
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-gray-medium hover:text-foreground transition-colors" aria-label="LinkedIn">
                      <Linkedin className="w-6 h-6" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input label="Nom" name="name" type="text" value={formData.name} onChange={handleChange} required placeholder="Votre nom" />
              <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="votre@email.com" />
              <Input label="Objet" name="subject" type="text" value={formData.subject} onChange={handleChange} required placeholder="Objet de votre message" />
              <Textarea label="Message" name="message" value={formData.message} onChange={handleChange} required placeholder="Votre message..." />
              {submitStatus === "success" && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-green-50 border border-green-200 rounded-sm text-green-800 text-sm">
                  {contactSuccessMessage}
                </motion.div>
              )}
              {submitStatus === "error" && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-50 border border-red-200 rounded-sm text-red-800 text-sm">
                  {contactErrorMessage}
                </motion.div>
              )}
              <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2">
                {isSubmitting ? "Envoi en cours..." : (<><Send className="w-4 h-4" /> Envoyer le message</>)}
              </Button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
