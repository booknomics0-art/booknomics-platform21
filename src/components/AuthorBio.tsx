import { useEffect, useState } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { findReviewedAuthorProfile } from "@/lib/reviewedHindiAuthors";

interface Props { author: string; category: string; title?: string; isHindi?: boolean }
interface OtherWork { title: string; slug: string; seo_slug: string | null }

const isPremchand = (name: string) =>
  /प्रेमचंद|premchand|prem chand/i.test(name);

// Source-checked editorial profile. Further authors must be verified individually;
// do not invent biographies or bibliography by reusing a generic author template.
const premchandBio = {
  hi: "मुंशी प्रेमचंद (1880–1936) हिंदी और उर्दू के प्रमुख कथाकार थे। उन्होंने किसान-जीवन, कर्ज़, जाति, स्त्री की स्थिति और सामाजिक अन्याय को मानवीय दृष्टि से लिखा। गोदान (1936) उनके अंतिम पूर्ण उपन्यासों में सबसे चर्चित है। उनकी अन्य प्रमुख रचनाओं में निर्मला, गबन, रंगभूमि, सेवासदन और कर्मभूमि शामिल हैं।",
  en: "Munshi Premchand (1880–1936) was a major Hindi and Urdu novelist and short-story writer. His fiction explored agrarian hardship, debt, caste, women's lives and social injustice with empathy and realism. Godaan (1936) is his last completed novel; his other major works include Nirmala, Gaban, Rangbhoomi, Sevasadan and Karmabhoomi.",
  source: "https://meacms.mea.gov.in/images/pdf/India-ChinaEncyclopedia_Vol-2.pdf",
};

export const AuthorBio = ({ author, category, title, isHindi = false }: Props) => {
  const [otherWorks, setOtherWorks] = useState<OtherWork[]>([]);
  useEffect(() => {
    let active = true;
    setOtherWorks([]);
    if (!author?.trim()) return () => { active = false; };
    supabase.from("books")
      .select("title,slug,seo_slug")
      .eq("author", author)
      .eq("is_draft", false)
      .eq("status", "published")
      .limit(12)
      .then(({ data }) => {
        if (active) setOtherWorks(((data || []) as OtherWork[])
          .filter((work) => work.title !== title)
          .filter((work, index, array) => array.findIndex((other) => other.title === work.title) === index)
          .slice(0, 5));
      });
    return () => { active = false; };
  }, [author, title]);

  const reviewedProfile = isPremchand(author) ? premchandBio : findReviewedAuthorProfile(author);
  const reviewed = Boolean(reviewedProfile);
  return (
    <section className="mt-12 pt-8 border-t border-border" aria-labelledby="author-bio">
      <div className="text-xs tracking-[0.14em] text-primary font-semibold mb-3">
        {isHindi ? "रचना और रचनाकार" : "About the author"}
      </div>
      <h2 id="author-bio" className="font-serif text-2xl md:text-3xl font-bold tracking-tight mb-4">
        {isHindi ? `लेखक परिचय: ${author}` : `About ${author}`}
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{isHindi ? "लेखक और प्रमुख कृतियाँ" : "The author and their works"}</span>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {reviewed ? (isHindi ? reviewedProfile!.hi : reviewedProfile!.en) : (
              isHindi
                ? `${author} इस पुस्तक के रचनाकार हैं। यह कृति ${category} विधा से संबंधित है। लेखक के जीवन, साहित्यिक योगदान और अन्य रचनाओं का तथ्य-जाँचा हुआ विस्तृत परिचय अभी संपादकीय समीक्षा में है।`
                : `${author} wrote the original work, ${title || "this book"}, in the ${category} category. A source-checked account of their life, literary contribution, and bibliography is pending editorial review.`
            )}
          </p>
          {reviewed && (
            <a className="text-xs text-primary underline mt-3 inline-block" href={reviewedProfile!.source} target="_blank" rel="noopener noreferrer">
              {isHindi ? "जीवनी व रचनाओं के लिए स्रोत" : "Biographical source"}
            </a>
          )}
          {otherWorks.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold mb-2">{isHindi ? "Booknomics पर अन्य कृतियाँ" : "More works on Booknomics"}</h3>
              <ul className="text-sm space-y-1.5">
                {otherWorks.map((work) => (
                  <li key={work.slug}>
                    <Link className="text-primary hover:underline" to={`/books/${work.seo_slug || work.slug}`}>{work.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 shadow-paper">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{isHindi ? "इस गाइड के बारे में" : "About this learning guide"}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isHindi
              ? "यह मूल पुस्तक का स्वतंत्र सारांश और आलोचनात्मक अध्ययन है, मूल लेखक की ओर से लिखा गया या उनके द्वारा समर्थित पाठ नहीं। संपूर्ण प्रसंग और भाषा के लिए मूल कृति पढ़ने की सलाह दी जाती है।"
              : "This is an independent Booknomics summary and analysis, not writing endorsed by the original author. Read the complete book for its original language, full context and nuance."}
          </p>
        </div>
      </div>
    </section>
  );
};
