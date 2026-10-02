import { describe, expect, it } from "vitest";
import { parseBulkBooks } from "@/lib/bookParser";

const wrap = (sections: string) => `#BOOK_START
Title: परीक्षण पुस्तक
Author: उदाहरण लेखक
Language: Hindi
Category: साहित्य
#HOOK
एक विशिष्ट पुस्तक
${sections}
#BOOK_END`;

describe("Hindi content quality gate", () => {
  it("rejects repeated Hinglish boilerplate instead of importing it", () => {
    const raw = wrap(`#SUMMARY
यह एक पुस्तक-विशिष्ट सारांश है।

#KEY_INSIGHTS
यह essay केवल information नहीं देता; वह reader को a particular way of seeing की ओर ले जाता है।
दूसरा प्रश्न audience का है।

#AUDIO_SCRIPT
इस विचार की जाँच करते समय claim, example और tone को अलग-अलग देखें।
तीसरा स्तर modern application का है।

#APPLY_TODAY
आज एक hidden assumption नोट करें।`);

    const result = parseBulkBooks(raw);
    expect(result.books).toHaveLength(0);
    expect(result.errors.join(" ")).toContain("repeated/generic template text");
  });

  it("rejects the old generic five-point Hindi filler template", () => {
    const raw = wrap(`#SUMMARY
यह सारांश पुस्तक के पात्रों, संघर्ष और शिल्प पर केंद्रित है।

#KEY_INSIGHTS
- पहला बिंदु पुस्तक की विशिष्ट घटना से जुड़ा है।

#APPLY_TODAY
1. आत्म-चिंतन का महत्व
2. रिश्तों की कीमत
3. सामाजिक जिम्मेदारी
4. नैतिक मूल्यों का पालन
5. परिवर्तन को स्वीकार करना

#AUDIO_SCRIPT
लेखक की शैली और पुस्तक की संरचना का विशिष्ट विश्लेषण।`);

    const result = parseBulkBooks(raw);
    expect(result.books).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("allows book-specific Hindi content", () => {
    const raw = wrap(`#SUMMARY
कहानी का केंद्र एक परिवार के भीतर बदलते संबंधों और आर्थिक दबाव से पैदा होने वाले निर्णयों पर है। कथानक इन्हीं निर्णयों के परिणामों को क्रमशः खोलता है।

#KEY_INSIGHTS
- केंद्रीय संघर्ष पात्रों की निजी इच्छा और सामाजिक अपेक्षा के बीच बनता है।
- लेखक संवादों के माध्यम से सत्ता-संबंधों को सामने लाते हैं।

#APPLY_TODAY
पढ़ते समय एक ऐसा निर्णय चिन्हित करें जहाँ पात्र के पास दो वास्तविक विकल्प हों और दोनों की कीमत अलग हो।

#AUDIO_SCRIPT
गहन विश्लेषण में कथानक, चरित्र-विकास, भाषा, सामाजिक संदर्भ और रचना की सीमाओं को अलग-अलग देखा गया है।`);

    const result = parseBulkBooks(raw);
    expect(result.errors).toEqual([]);
    expect(result.books).toHaveLength(1);
    expect(result.books[0].language).toBe("hi");
  });
});
