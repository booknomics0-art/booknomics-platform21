# Booknomics — Source-Specific Quizzes: Requested Next 500

**Date:** 22 October 2026  
**Verification:** Live connected database (Supabase)  
**Target:** 500 new book-specific quiz sets  
**Actually saved and verified in this execution:** **77 books, 770 questions**  
**Still short of the requested target:** **423 books**  
**Previously completed quiz books:** 1,621  
**New platform total:** **1,698 quiz books, 16,980 stored questions**  
**Remaining published books without quizzes:** **3,329**

## Why 500 are not reported complete

Most of the remaining Booknomics summaries were written as generic interpretive guides, with repeated boilerplate that contains few specific facts about characters, plot, or a book's distinct theoretical framework. Merely joining sentence fragments into quizzes would not meet the requirement for reliable book-specific MCQs.

This execution used a higher bar than structural validity alone: it selected 26 books with five separate, substantive `key_ideas` claims, and 51 additional manually shortlisted books with four identifiable topic/plot claims. Quizzes were composed offline without Gemini, Lovable, or another external AI-generation API and written only to empty `draft` quiz arrays.

**Critical limitation:** Source excerpt matches are against the current Booknomics `books.key_ideas` content. No systematic independent primary-text verification was done for all 77 books. Thus these are stronger source-specific **editorial drafts**, *not* certified fact-checked or ready for publication.

One candidate, `दिव्या`, was excluded because the available book attribution/content appeared inconsistent.

## Exact database checks

| Measure | Verified |
|---|---:|
| New books | 77 |
| Hindi books | 35 |
| English books | 42 |
| New MCQs | 770 |
| Four distinct options | 770 / 770 |
| Correct-answer indices 0–3 | 770 / 770 |
| Explanation length checks | 770 / 770 |
| Exact matches to stored key_ideas excerpts | 770 / 770 |
| Comparisons with two source excerpts | 436 / 436 |
| Unique question texts | 770 |
| Basic | 231 |
| Medium | 308 |
| Advanced | 231 |
| New asset rows with draft status | 77 |
| Prior quizzes overwritten | 0 |

## Visibility and editorial caution

The app's asset fetcher and current public read policy may permit users to fetch quizzes regardless of a `draft` status. Do **not** assume these quizzes are hidden. The site UI has not been manually tested end-to-end for these 77 sets. Independent fact-checking, choice plausibility, real difficulty, local-language phrasing and browser tests remain necessary.

## Per-book manifest

| # | Title | Author | Language | Questions | Status | ID |
|---:|---|---|---|---:|---|---|
| 1 | Big Breasts and Wide Hips | Mo Yan | en | 10 | draft | `219cd66c-40d3-40d2-9ff2-6c926d36c163` |
| 2 | Border Town | Shen Congwen | en | 10 | draft | `2962a07e-2c13-4ea8-a540-22acff8811a2` |
| 3 | Brothers | Yu Hua | en | 10 | draft | `62106526-e115-4ba9-920e-bd467d3eba63` |
| 4 | Chronicle of a Blood Merchant | Yu Hua | en | 10 | draft | `707e2279-2865-4ef1-8ee1-e8aadaf03ff9` |
| 5 | Diary of a Madman | Lu Xun | en | 10 | draft | `99ba6bd2-30e3-4606-b6a9-29ef7a85d9bd` |
| 6 | Dream of the Red Chamber | Cao Xueqin | en | 10 | draft | `15293a68-6059-46df-a5a7-1f27867790ee` |
| 7 | Fortress Besieged | Qian Zhongshu | en | 10 | draft | `5646b6a6-284d-4dc3-86d2-0e064ed4f100` |
| 8 | Four Generations Under One Roof | Lao She | en | 10 | draft | `d9963d0a-8099-44b8-8e8a-047785981416` |
| 9 | Frog | Mo Yan | en | 10 | draft | `51055cc4-51fa-4bb6-b563-4e40da737fbb` |
| 10 | Lenin's Kisses | Yan Lianke | en | 10 | draft | `b5959c22-2e08-4d46-95a8-72225b76fbdf` |
| 11 | Life and Death Are Wearing Me Out | Mo Yan | en | 10 | draft | `e4d5dfae-1da7-400f-ae87-5dcce5496fb8` |
| 12 | Love in a Fallen City | Eileen Chang | en | 10 | draft | `0a8644bd-1400-422b-a397-a19729ad20bd` |
| 13 | One Man's Bible | Gao Xingjian | en | 10 | draft | `d87b04e0-7232-4fcd-8c7f-f6a27302178f` |
| 14 | Raise the Red Lantern | Su Tong | en | 10 | draft | `ca3b6517-b003-4d42-81cd-1b5bbf803234` |
| 15 | Rich Dad Poor Dad | Robert T. Kiyosaki with Sharon Lechter | en | 10 | draft | `b0ec5aab-f4b7-47ee-b55d-8aeac8a8f533` |
| 16 | Romance of the Three Kingdoms | Luo Guanzhong | en | 10 | draft | `d55e8e36-9d38-44cb-b654-f6be85aa8353` |
| 17 | Serve the People! | Yan Lianke | en | 10 | draft | `1427e077-090e-44ef-b32f-6e6877311a50` |
| 18 | Soul Mountain | Gao Xingjian | en | 10 | draft | `cff8aaef-ee24-48fc-b7fd-cdf2f31fb084` |
| 19 | Spring | Ba Jin | en | 10 | draft | `c3e5ce70-80b2-4e8f-9da1-f97cea9acfab` |
| 20 | Start with Why | Simon Sinek | en | 10 | draft | `eeb531fe-7b9d-44df-98f7-187104bf984f` |
| 21 | Strange Tales from a Chinese Studio | Pu Songling | en | 10 | draft | `3e2973c3-9d86-4597-a3ef-0e76e065d370` |
| 22 | The Dark Forest | Liu Cixin | en | 10 | draft | `e8f44709-6204-4b9a-a385-a8944d4db6e6` |
| 23 | The Fat Years | Chan Koonchung | en | 10 | draft | `5335e728-c945-43b9-89e9-e1203867a072` |
| 24 | The Four Books | Yan Lianke | en | 10 | draft | `66572e10-e6e7-44c7-a387-b9de5fd2832e` |
| 25 | The Garlic Ballads | Mo Yan | en | 10 | draft | `4494c7fc-bb32-4ab8-bb4f-48ebd62c9184` |
| 26 | The Innovator's Dilemma | Clayton M. Christensen | en | 10 | draft | `37bdaf9d-665a-4bee-91dd-68b6b2de534c` |
| 27 | The Millionaire Next Door | Thomas J. Stanley and William D. Danko | en | 10 | draft | `e81a140d-f40c-49d5-9264-fb565892a35d` |
| 28 | The Moon Opera | Bi Feiyu | en | 10 | draft | `f20c7f25-c553-47d4-bd06-e6da8615e929` |
| 29 | The ONE Thing | Gary Keller and Jay Papasan | en | 10 | draft | `45b26eb4-21de-4150-81b8-2b53a1b91fe9` |
| 30 | The Paradox of Choice | Barry Schwartz | en | 10 | draft | `e291eabc-8462-49b3-996f-6d039ed67ea2` |
| 31 | The Plum in the Golden Vase | Lanling Xiaoxiao Sheng | en | 10 | draft | `4d69ceca-85e4-4ace-9870-8dd57c2a6136` |
| 32 | The Power of Habit | Charles Duhigg | en | 10 | draft | `9e09acdb-7c9d-40bb-ab0c-75fa42a5142b` |
| 33 | The Psychology of Money | Morgan Housel | en | 10 | draft | `132084bd-122f-483f-974c-7dcb60ece79f` |
| 34 | The Richest Man in Babylon | George S. Clason | en | 10 | draft | `ba7487f5-4bc5-4355-bc95-d912d1852243` |
| 35 | The Seventh Day | Yu Hua | en | 10 | draft | `e1e49b98-4415-43f5-a9c8-4c6264e9f6dd` |
| 36 | The War of Art | Steven Pressfield | en | 10 | draft | `7d5dfd45-a848-4fcb-83a7-8d50a9316011` |
| 37 | The Waste Tide | Chen Qiufan | en | 10 | draft | `8b1c03c8-b41f-41a9-a5a6-cbd4609dbd2a` |
| 38 | Think and Grow Rich | Napoleon Hill | en | 10 | draft | `554dea31-67fa-4691-bd5c-3133ad7562bf` |
| 39 | Thinking, Fast and Slow | Daniel Kahneman | en | 10 | draft | `02004bfc-bfac-4494-9b06-4ca794ca7341` |
| 40 | Three Sisters | Bi Feiyu | en | 10 | draft | `08526433-02af-4f89-b826-fd7f14dc4615` |
| 41 | To Live | Yu Hua | en | 10 | draft | `1bee150d-2138-47ee-89c4-3810b983e31a` |
| 42 | Zero to One | Peter Thiel with Blake Masters | en | 10 | draft | `bf0ab162-ffb7-419e-84a1-96d4727fbabc` |
| 43 | Aarachar | K. R. Meera | hi | 10 | draft | `7e62634b-5292-46da-bc00-83102310577c` |
| 44 | Akhepatar | Bindu Bhatt | hi | 10 | draft | `5509fd5e-462d-4c50-a39c-0faaa0cc5b15` |
| 45 | Akkarmashi | Sharankumar Limbale | hi | 10 | draft | `80c0baa0-0db9-45f6-bdba-95a0a2066afa` |
| 46 | Alai Osai | Kalki Krishnamurthy | hi | 10 | draft | `d5e934b3-b1e3-48c8-801d-c1663c388ce6` |
| 47 | Amrita | Raghuveer Chaudhari | hi | 10 | draft | `204ad8cb-86be-42fd-9045-148dbfd28078` |
| 48 | Bhadrambhadra | Ramanbhai Neelkanth | hi | 10 | draft | `25897ceb-ca65-4b9e-a128-b843be9ce002` |
| 49 | Char Adhyay | Rabindranath Tagore | hi | 10 | draft | `f3886d4e-90b7-4bd0-ae05-25dfb43cdf2a` |
| 50 | Devdas | Sarat Chandra Chattopadhyay | hi | 10 | draft | `1356fd9b-a96b-443b-bc7a-d73b8392f7ec` |
| 51 | Devi Chaudhurani | Bankim Chandra Chattopadhyay | hi | 10 | draft | `68a04467-d295-4ade-9ac9-2d1e90d10bf5` |
| 52 | Khasakkinte Itihasam | O. V. Vijayan | hi | 10 | draft | `9a85e129-f123-4554-a23a-e9029dafc34d` |
| 53 | Natsamrat | V. V. Shirwadkar | hi | 10 | draft | `51c9bfeb-88f5-470d-8e49-b8a0c4cd7ae3` |
| 54 | Pather Dabi | Sarat Chandra Chattopadhyay | hi | 10 | draft | `ec5a700e-6f06-4107-a960-1a39ddb77914` |
| 55 | Sakharam Binder | Vijay Tendulkar | hi | 10 | draft | `de175166-889c-425a-bb1b-0958e07ae8e9` |
| 56 | अवसर | नरेन्द्र कोहली | hi | 10 | draft | `7d7f1155-b376-445e-83da-d4638547da53` |
| 57 | अहिल्याबाई | वृंदावनलाल वर्मा | hi | 10 | draft | `2991efc9-2f9b-4fc1-aa11-91b1580f2dc2` |
| 58 | आषाढ़ का एक दिन | मोहन राकेश | hi | 10 | draft | `85e45929-e98f-4901-a095-d726c3bc1737` |
| 59 | क्रिएटिव यूनिटी | रवींद्रनाथ ठाकुर | hi | 10 | draft | `abda9009-59bc-41a2-98c2-e39e0d4f7d06` |
| 60 | चित्रलेखा | भगवती चरण वर्मा | hi | 10 | draft | `0ca9dedc-ebc6-4434-a19a-c1b9cbe81c11` |
| 61 | जीवन का आचरण | राल्फ वाल्डो इमर्सन | hi | 10 | draft | `faee0b38-fdd1-4d54-96ea-314484e2912c` |
| 62 | तमस | भीष्म साहनी | hi | 10 | draft | `91b32ab3-5abe-4853-982a-1213471ad23d` |
| 63 | द अमेरिकन स्कॉलर | राल्फ वाल्डो इमर्सन | hi | 10 | draft | `63058130-783f-4882-a7ee-d0f05f8567b5` |
| 64 | द क्राउन ऑफ वाइल्ड ऑलिव | जॉन रस्किन | hi | 10 | draft | `5f6e8dfe-d8ae-46b7-a2fc-0096479881ef` |
| 65 | नशा | मुंशी प्रेमचंद | hi | 10 | draft | `f0bf8070-59c0-4359-9f5d-caf568a04822` |
| 66 | निबंध: द्वितीय श्रृंखला | राल्फ वाल्डो इमर्सन | hi | 10 | draft | `10a75d0e-0adf-46e9-b64e-6615f9bfc758` |
| 67 | निबंध: प्रथम श्रृंखला | राल्फ वाल्डो इमर्सन | hi | 10 | draft | `13c0f581-62be-46c6-a44f-258f0b6ffa5c` |
| 68 | नेचर | राल्फ वाल्डो इमर्सन | hi | 10 | draft | `60ee395f-7ccc-40fb-8143-ac7b35a376ae` |
| 69 | माई मास्टर | स्वामी विवेकानंद | hi | 10 | draft | `7cabee2e-9cf4-4a19-aa1b-0bb371818694` |
| 70 | मानस का हंस | अमृतलाल नागर | hi | 10 | draft | `dc1b3cdf-d576-4485-9cd5-b63352c5ac59` |
| 71 | मुर्दों का टीला | रांगेय राघव | hi | 10 | draft | `0f1a3124-b687-4d01-a67e-e5d9b9c54496` |
| 72 | रश्मिरथी | रामधारी सिंह दिनकर | hi | 10 | draft | `32de351c-fb11-44a0-9f8b-7a5bfad48c48` |
| 73 | राग दरबारी | श्रीलाल शुक्ल | hi | 10 | draft | `98efb753-3024-47aa-8428-f03e1ad80999` |
| 74 | वे दिन | निर्मल वर्मा | hi | 10 | draft | `17cc13eb-7aef-4aad-841e-6f97a7fde0a4` |
| 75 | सती | मुंशी प्रेमचंद | hi | 10 | draft | `b09cd164-ab2b-4ed4-b3cb-e9dcbd041acc` |
| 76 | सवा सेर गेहूँ | मुंशी प्रेमचंद | hi | 10 | draft | `7ab2ed75-de99-425d-9285-b70a6ebbfad4` |
| 77 | सात घूँघट वाला मुखड़ा | अमृतलाल नागर | hi | 10 | draft | `d6f27f18-660b-4ff4-9f6c-db5ee9cfa7e6` |

## Next quality gate

A verified corpus or primary/credible reference for each of the other 423 desired books, rewrite generic learning sections, build 10 distinct pedagogically valuable questions per book, inspect plausibility of distractors, verify original-source attribution, and only then mark them as editorially approved.
