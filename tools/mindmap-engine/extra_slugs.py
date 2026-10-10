"""English slugs from the live Booknomics sitemap that sit outside the seed catalog."""

from __future__ import annotations

import re

# Trailing `-summary` slugs, ASCII only, not hindi-summary / saransh.
EXTRA_SLUGS = """
who-moved-my-cheese-spencer-johnson-summary
the-midnight-library-matt-haig-summary
the-organized-mind-daniel-j-levitin-summary
principle-centered-leadership-stephen-r-covey-summary
the-sea-of-monsters-rick-riordan-summary
night-watch-terry-pratchett-summary
elon-musk-ashlee-vance-summary
the-dictionary-of-body-language-joe-navarro-summary
the-hate-u-give-angie-thomas-summary
the-silmarillion-j-r-r-tolkien-summary
the-alloy-of-law-brandon-sanderson-summary
accelerate-nicole-forsgren-jez-humble-gene-kim-summary
a-tale-of-two-cities-charles-dickens-summary
if-you-tell-gregg-olsen-summary
outliers-malcolm-gladwell-summary
green-mars-kim-stanley-robinson-summary
start-up-william-j-stolze-summary
brain-damage-freida-mcfadden-summary
blindsight-peter-watts-summary
sociology-john-j-macionis-summary
spqr-a-history-of-ancient-rome-mary-beard-summary
the-e-myth-revisited-rev-ed-michael-e-gerber-summary
civilization-and-its-discontents-sigmund-freud-summary
binti-nnedi-okorafor-summary
a-christmas-carol-charles-dickens-summary
capital-volume-i-karl-marx-summary
essays-ralph-waldo-emerson-summary
the-right-stuff-tom-wolfe-summary
the-rudest-book-ever-shwetabh-gangwar-summary
twilight-stephenie-meyer-summary
attached-amir-levine-and-rachel-heller-summary
born-to-run-christopher-mcdougall-summary
the-future-is-faster-than-you-think-peter-h-diamandis-steven-kotler-summary
who-stole-the-american-dream-burke-hedges-summary
competing-against-luck-clayton-m-christensen-summary
marketing-4-0-philip-kotler-summary
klara-and-the-sun-kazuo-ishiguro-summary
when-the-scientific-secrets-of-perfect-timing-daniel-h-pink-summary
nausea-jean-paul-sartre-summary
the-long-walk-stephen-king-summary
doglapan-ashneer-grover-summary
personal-finance-jack-r-kapoor-summary
christine-stephen-king-summary
daisy-jones-the-six-taylor-jenkins-reid-summary
leadership-robert-n-lussier-summary
the-pig-that-wants-to-be-eaten-julian-baggini-summary
through-the-looking-glass-lewis-carroll-summary
desert-solitaire-edward-abbey-summary
the-vital-question-nick-lane-summary
the-master-of-go-yasunari-kawabata-summary
brisingr-christopher-paolini-summary
alexander-hamilton-ron-chernow-summary
lean-analytics-alistair-croll-and-benjamin-yoskovitz-summary
adventures-of-huckleberry-finn-mark-twain-summary
the-woman-in-the-dunes-kobo-abe-summary
the-botany-of-desire-michael-pollan-summary
the-social-construction-of-reality-peter-l-berger-thomas-luckmann-summary
britt-marie-was-here-fredrik-backman-summary
confirmed-bachelor-roberta-leigh-summary
the-makioka-sisters-jun-ichiro-tanizaki-summary
the-art-of-memoir-mary-karr-summary
the-brain-that-changes-itself-norman-doidge-summary
the-man-in-the-high-castle-philip-k-dick-summary
snow-orhan-pamuk-summary
the-hidden-kingdom-tui-sutherland-summary
man-and-his-symbols-carl-g-jung-summary
persepolis-1-2-marjane-satrapi-summary
the-effective-executive-peter-f-drucker-summary
the-hot-zone-richard-preston-summary
keeper-of-the-lost-cities-shannon-messenger-summary
how-to-talk-so-kids-will-listen-listen-so-kids-will-talk-adele-faber-elaine-mazlish-summary
green-eggs-and-ham-dr-seuss-summary
just-listen-mark-goulston-summary
masnavi-rumi-summary
bleak-house-charles-dickens-summary
one-day-in-the-life-of-ivan-denisovich-aleksandr-solzhenitsyn-summary
cloud-atlas-david-mitchell-summary
you-2-price-pritchett-summary
clockwork-angel-cassandra-clare-summary
the-warren-buffett-way-robert-g-hagstrom-summary
the-toyota-way-jeffrey-k-liker-summary
the-servant-as-leader-robert-k-greenleaf-summary
tough-minded-leadership-joe-d-batten-summary
the-wind-in-the-willows-kenneth-grahame-summary
the-dark-secret-tui-t-sutherland-summary
the-enduring-vision-paul-s-boyer-summary
a-short-guide-to-writing-about-biology-jan-a-pechenik-summary
cujo-stephen-king-summary
public-speaking-and-influencing-men-in-business-dale-carnegie-summary
ikigai-hector-garcia-francesc-miralles-summary
the-100-startup-chris-guillebeau-summary
descartes-error-antonio-damasio-summary
wizard-s-first-rule-terry-goodkind-summary
the-talisman-stephen-king-peter-straub-summary
new-moon-stephenie-meyer-summary
cancer-ward-aleksandr-solzhenitsyn-summary
women-who-run-with-the-wolves-clarissa-pinkola-estes-summary
wise-and-otherwise-sudha-murti-summary
the-energy-of-money-maria-nemeth-summary
rainbow-six-tom-clancy-summary
the-murders-in-the-rue-morgue-edgar-allan-poe-summary
how-to-read-a-person-like-a-book-gerard-i-nierenberg-summary
the-death-of-ivan-ilyich-leo-tolstoy-summary
darkstalker-tui-t-sutherland-summary
catching-fire-suzanne-collins-summary
cashvertising-drew-eric-whitman-summary
the-seven-deaths-of-evelyn-hardcastle-stuart-turton-summary
buy-yourself-the-damn-flowers-tam-kaur-summary
the-theory-of-moral-sentiments-adam-smith-summary
prelude-to-foundation-isaac-asimov-summary
outliers-the-story-of-success-malcolm-gladwell-summary
the-discipline-of-market-leaders-michael-treacy-summary
the-anxious-generation-jonathan-haidt-summary
how-to-fail-at-almost-everything-and-still-win-big-scott-adams-summary
on-liberty-john-stuart-mill-summary
untamed-glennon-doyle-summary
who-owns-the-future-jaron-lanier-summary
dream-of-the-red-chamber-cao-xueqin-summary
becoming-a-technical-leader-gerald-m-weinberg-summary
the-world-is-flat-thomas-l-friedman-summary
colorless-tsukuru-tazaki-and-his-years-of-pilgrimage-haruki-murakami-summary
the-only-investment-guide-you-ll-ever-need-andrew-p-tobias-summary
chapterhouse-dune-frank-herbert-summary
the-fountainhead-ayn-rand-summary
ship-of-magic-robin-hobb-summary
the-housemaid-freida-mcfadden-summary
the-restaurant-at-the-end-of-the-universe-douglas-adams-summary
the-daily-stoic-ryan-holiday-and-stephen-hanselman-summary
narcissus-and-goldmund-hermann-hesse-summary
the-consolations-of-philosophy-alain-de-botton-summary
the-art-of-seduction-robert-greene-summary
a-child-called-it-david-j-pelzer-summary
100m-leads-alex-hormozi-summary
in-search-of-lost-time-marcel-proust-summary
the-laws-of-human-nature-robert-greene-summary
big-magic-elizabeth-gilbert-summary
three-men-in-a-boat-jerome-k-jerome-summary
the-first-fifteen-lives-of-harry-august-claire-north-summary
the-currents-of-space-isaac-asimov-summary
the-scarlet-pimpernel-baroness-orczy-summary
the-winter-s-tale-william-shakespeare-summary
entrepreneurship-marc-j-dollinger-summary
the-shadow-of-the-torturer-gene-wolfe-summary
convenience-store-woman-sayaka-murata-summary
2010-odyssey-two-arthur-c-clarke-summary
the-gulag-archipelago-aleksandr-solzhenitsyn-summary
twisted-games-ana-huang-summary
drive-the-surprising-truth-about-what-motivates-us-daniel-h-pink-summary
human-acts-han-kang-summary
evicted-matthew-desmond-summary
les-miserables-victor-hugo-summary
the-unicorn-project-gene-kim-summary
bird-by-bird-anne-lamott-summary
digital-fortress-dan-brown-summary
introduction-to-leadership-peter-g-northouse-summary
you-can-heal-your-life-louise-l-hay-summary
to-live-yu-hua-summary
what-do-you-care-what-other-people-think-richard-p-feynman-summary
superintelligence-nick-bostrom-summary
the-absorbent-mind-maria-montessori-summary
the-death-of-artemio-cruz-carlos-fuentes-summary
the-razor-s-edge-w-somerset-maugham-summary
tuesdays-with-morrie-mitch-albom-summary
beware-of-pity-stefan-zweig-summary
the-last-colony-john-scalzi-summary
the-copywriters-handbook-robert-w-bly-summary
the-immoralist-andre-gide-summary
the-problems-of-philosophy-bertrand-russell-summary
the-abolition-of-man-c-s-lewis-summary
the-anthropocene-reviewed-john-green-summary
the-spanish-love-deception-elena-armas-summary
under-a-white-sky-elizabeth-kolbert-summary
beartown-fredrik-backman-summary
the-elementary-particles-michel-houellebecq-summary
the-shape-of-water-andrea-camilleri-summary
golden-fool-robin-hobb-summary
the-passion-according-to-g-h-clarice-lispector-summary
my-merry-mornings-ivan-klima-summary
the-court-dancer-shin-kyung-sook-summary
the-chandelier-clarice-lispector-summary
those-who-leave-and-those-who-stay-elena-ferrante-summary
the-feast-of-the-goat-mario-vargas-llosa-summary
the-murderess-alexandros-papadiamantis-summary
heart-of-a-dog-mikhail-bulgakov-summary
sagarana-joao-guimaraes-rosa-summary
dream-of-ding-village-yan-lianke-summary
bandarshah-tayeb-salih-summary
love-in-a-fallen-city-eileen-chang-summary
three-comrades-erich-maria-remarque-summary
delirium-laura-restrepo-summary
lost-illusions-honore-de-balzac-summary
silence-shusaku-endo-summary
see-under-love-david-grossman-summary
my-grandmother-asked-me-to-tell-you-she-s-sorry-fredrik-backman-summary
the-enlightenment-of-the-greengage-tree-shokoofeh-azar-summary
she-came-to-stay-simone-de-beauvoir-summary
le-deuxieme-sexe-simone-de-beauvoir-summary
christ-stopped-at-eboli-carlo-levi-summary
the-speed-of-light-javier-cercas-summary
the-clown-heinrich-boll-summary
the-discomfort-of-evening-lucas-rijneveld-summary
on-heroes-and-tombs-ernesto-sabato-summary
thirst-mahmoud-dowlatabadi-summary
palace-of-desire-naguib-mahfouz-summary
zadig-voltaire-summary
baron-wenckheim-s-homecoming-laszlo-krasznahorkai-summary
someone-to-run-with-david-grossman-summary
the-discovery-of-heaven-harry-mulisch-summary
war-and-war-laszlo-krasznahorkai-summary
hhhh-laurent-binet-summary
serve-the-people-yan-lianke-summary
never-the-twain-abdul-muis-summary
swallowing-mercury-wioletta-greg-summary
gosta-berling-s-saga-selma-lagerlof-summary
the-young-die-old-nguyen-binh-phuong-summary
the-alienist-machado-de-assis-summary
blooms-of-darkness-aharon-appelfeld-summary
a-woman-in-jerusalem-a-b-yehoshua-summary
the-hill-of-evil-counsel-amos-oz-summary
my-family-and-other-animals-gerald-durrell-summary
esther-s-inheritance-sandor-marai-summary
siyasatnama-nizam-al-mulk-summary
my-name-is-red-orhan-pamuk-summary
the-memorandum-vaclav-havel-summary
the-street-of-crocodiles-bruno-schulz-summary
the-republic-of-wine-mo-yan-summary
the-sea-speaks-his-name-leila-s-chudori-summary
the-overcoat-nikolai-gogol-summary
man-tiger-eka-kurniawan-summary
bitter-orange-tree-jokha-alharthi-summary
fatelessness-imre-kertesz-summary
the-hooligan-s-return-norman-manea-summary
parallel-stories-peter-nadas-summary
the-house-of-bernarda-alba-federico-garcia-lorca-summary
patterns-of-childhood-christa-wolf-summary
house-of-day-house-of-night-olga-tokarczuk-summary
the-colonel-mahmoud-dowlatabadi-summary
all-that-is-gone-pramoedya-ananta-toer-summary
the-jder-brothers-mihail-sadoveanu-summary
baharestan-jami-summary
the-bed-of-procrustes-nassim-nicholas-taleb-summary
atlas-shrugged-ayn-rand-summary
how-to-win-friends-and-influence-people-dale-carnegie-summary
the-power-of-your-subconscious-mind-joseph-murphy-summary
the-intelligent-investor-benjamin-graham-summary
the-mountain-is-you-brianna-wiest-summary
can-t-hurt-me-david-goggins-summary
atomic-habits-james-clear-summary
deep-work-cal-newport-summary
rich-dad-poor-dad-robert-t-kiyosaki-summary
thinking-fast-and-slow-daniel-kahneman-summary
man-s-search-for-meaning-viktor-e-frankl-summary
the-7-habits-of-highly-effective-people-stephen-r-covey-summary
wings-of-fire-a-p-j-abdul-kalam-summary
the-psychology-of-money-morgan-housel-summary
the-lean-startup-eric-ries-summary
zero-to-one-peter-thiel-summary
sapiens-yuval-noah-harari-summary
meditations-marcus-aurelius-summary
the-obstacle-is-the-way-ryan-holiday-summary
ego-is-the-enemy-ryan-holiday-summary
stillness-is-the-key-ryan-holiday-summary
the-subtle-art-of-not-giving-a-f-ck-mark-manson-summary
essentialism-greg-mckeown-summary
digital-minimalism-cal-newport-summary
emotional-intelligence-daniel-goleman-summary
factfulness-hans-rosling-summary
a-brief-history-of-time-stephen-hawking-summary
blue-ocean-strategy-w-chan-kim-renee-mauborgne-summary
good-to-great-jim-collins-summary
mindset-carol-s-dweck-summary
grit-angela-duckworth-summary
influence-robert-b-cialdini-summary
getting-things-done-david-allen-summary
the-one-thing-gary-keller-summary
start-with-why-simon-sinek-summary
never-split-the-difference-chris-voss-summary
the-alchemist-paulo-coelho-summary
dune-frank-herbert-summary
1984-george-orwell-summary
animal-farm-george-orwell-summary
the-power-of-now-eckhart-tolle-summary
the-four-agreements-don-miguel-ruiz-summary
the-power-of-habit-charles-duhigg-summary
shoe-dog-phil-knight-summary
freakonomics-steven-d-levitt-stephen-j-dubner-summary
nudge-richard-h-thaler-cass-r-sunstein-summary
antifragile-nassim-nicholas-taleb-summary
the-black-swan-nassim-nicholas-taleb-summary
fooled-by-randomness-nassim-nicholas-taleb-summary
principles-ray-dalio-summary
the-body-keeps-the-score-bessel-van-der-kolk-summary
thinking-in-bets-annie-duke-summary
quiet-susan-cain-summary
flow-mihaly-csikszentmihalyi-summary
drive-daniel-h-pink-summary
when-daniel-h-pink-summary
make-time-jake-knapp-summary
sprint-jake-knapp-summary
hooked-nir-eyal-summary
indistractable-nir-eyal-summary
hyperfocus-chris-bailey-summary
four-thousand-weeks-oliver-burkeman-summary
why-we-sleep-matthew-walker-summary
peak-anders-ericsson-summary
ultralearning-scott-h-young-summary
so-good-they-can-t-ignore-you-cal-newport-summary
slow-productivity-cal-newport-summary
rework-jason-fried-summary
the-hard-thing-about-hard-things-ben-horowitz-summary
high-output-management-andrew-s-grove-summary
the-innovator-s-dilemma-clayton-m-christensen-summary
crossing-the-chasm-geoffrey-a-moore-summary
measure-what-matters-john-doerr-summary
the-mom-test-rob-fitzpatrick-summary
the-goal-eliyahu-m-goldratt-summary
the-phoenix-project-gene-kim-summary
inspired-marty-cagan-summary
made-to-stick-chip-heath-summary
switch-chip-heath-summary
this-is-marketing-seth-godin-summary
purple-cow-seth-godin-summary
leaders-eat-last-simon-sinek-summary
the-infinite-game-simon-sinek-summary
radical-candor-kim-scott-summary
crucial-conversations-kerry-patterson-summary
the-five-dysfunctions-of-a-team-patrick-lencioni-summary
creativity-inc-ed-catmull-summary
the-almanack-of-naval-ravikant-eric-jorgenson-summary
poor-charlie-s-almanack-charles-t-munger-summary
the-richest-man-in-babylon-george-s-clason-summary
the-millionaire-next-door-thomas-j-stanley-summary
i-will-teach-you-to-be-rich-ramit-sethi-summary
the-simple-path-to-wealth-j-l-collins-summary
a-random-walk-down-wall-street-burton-g-malkiel-summary
the-little-book-of-common-sense-investing-john-c-bogle-summary
one-up-on-wall-street-peter-lynch-summary
the-essays-of-warren-buffett-warren-e-buffett-summary
the-most-important-thing-howard-marks-summary
the-big-short-michael-lewis-summary
liar-s-poker-michael-lewis-summary
moneyball-michael-lewis-summary
extreme-ownership-jocko-willink-summary
turn-the-ship-around-l-david-marquet-summary
dare-to-lead-brene-brown-summary
daring-greatly-brene-brown-summary
the-gifts-of-imperfection-brene-brown-summary
atomic-habits-james-clear-summary
tiny-habits-bj-fogg-summary
the-compound-effect-darren-hardy-summary
the-miracle-morning-hal-elrod-summary
the-5-am-club-robin-sharma-summary
the-monk-who-sold-his-ferrari-robin-sharma-summary
eat-that-frog-brian-tracy-summary
as-a-man-thinketh-james-allen-summary
the-untethered-soul-michael-a-singer-summary
a-new-earth-eckhart-tolle-summary
the-prophet-kahlil-gibran-summary
siddhartha-hermann-hesse-summary
tao-te-ching-lao-tzu-summary
the-art-of-war-sun-tzu-summary
walden-henry-david-thoreau-summary
self-reliance-ralph-waldo-emerson-summary
the-republic-plato-summary
nicomachean-ethics-aristotle-summary
letters-from-a-stoic-seneca-summary
the-myth-of-sisyphus-albert-camus-summary
the-stranger-albert-camus-summary
long-walk-to-freedom-nelson-mandela-summary
steve-jobs-walter-isaacson-summary
einstein-walter-isaacson-summary
leonardo-da-vinci-walter-isaacson-summary
educated-tara-westover-summary
becoming-michelle-obama-summary
born-a-crime-trevor-noah-summary
when-breath-becomes-air-paul-kalanithi-summary
the-glass-castle-jeannette-walls-summary
unbroken-laura-hillenbrand-summary
into-thin-air-jon-krakauer-summary
homo-deus-yuval-noah-harari-summary
21-lessons-for-the-21st-century-yuval-noah-harari-summary
guns-germs-and-steel-jared-diamond-summary
why-nations-fail-daron-acemoglu-james-a-robinson-summary
prisoners-of-geography-tim-marshall-summary
caste-isabel-wilkerson-summary
enlightenment-now-steven-pinker-summary
cosmos-carl-sagan-summary
the-selfish-gene-richard-dawkins-summary
the-gene-siddhartha-mukherjee-summary
the-emperor-of-all-maladies-siddhartha-mukherjee-summary
the-immortal-life-of-henrietta-lacks-rebecca-skloot-summary
seven-brief-lessons-on-physics-carlo-rovelli-summary
the-code-breaker-walter-isaacson-summary
breath-james-nestor-summary
to-kill-a-mockingbird-harper-lee-summary
the-great-gatsby-f-scott-fitzgerald-summary
pride-and-prejudice-jane-austen-summary
jane-eyre-charlotte-bronte-summary
wuthering-heights-emily-bronte-summary
hamlet-william-shakespeare-summary
macbeth-william-shakespeare-summary
romeo-and-juliet-william-shakespeare-summary
crime-and-punishment-fyodor-dostoevsky-summary
anna-karenina-leo-tolstoy-summary
war-and-peace-leo-tolstoy-summary
moby-dick-herman-melville-summary
catch-22-joseph-heller-summary
slaughterhouse-five-kurt-vonnegut-summary
the-catcher-in-the-rye-j-d-salinger-summary
lord-of-the-flies-william-golding-summary
one-hundred-years-of-solitude-gabriel-garcia-marquez-summary
things-fall-apart-chinua-achebe-summary
beloved-toni-morrison-summary
the-kite-runner-khaled-hosseini-summary
life-of-pi-yann-martel-summary
the-hobbit-j-r-r-tolkien-summary
the-lord-of-the-rings-j-r-r-tolkien-summary
a-game-of-thrones-george-r-r-martin-summary
the-name-of-the-wind-patrick-rothfuss-summary
mistborn-brandon-sanderson-summary
the-way-of-kings-brandon-sanderson-summary
american-gods-neil-gaiman-summary
foundation-isaac-asimov-summary
neuromancer-william-gibson-summary
the-left-hand-of-darkness-ursula-k-le-guin-summary
the-hitchhiker-s-guide-to-the-galaxy-douglas-adams-summary
ender-s-game-orson-scott-card-summary
the-martian-andy-weir-summary
project-hail-mary-andy-weir-summary
frankenstein-mary-shelley-summary
and-then-there-were-none-agatha-christie-summary
murder-on-the-orient-express-agatha-christie-summary
the-hound-of-the-baskervilles-arthur-conan-doyle-summary
gone-girl-gillian-flynn-summary
the-silent-patient-alex-michaelides-summary
the-da-vinci-code-dan-brown-summary
the-notebook-nicholas-sparks-summary
normal-people-sally-rooney-summary
call-me-by-your-name-andre-aciman-summary
the-time-traveler-s-wife-audrey-niffenegger-summary
the-artists-way-julia-cameron-summary
the-choice-factory-richard-shotton-summary
the-general-theory-of-employment-interest-and-money-john-maynard-keynes-summary
the-call-of-the-wild-jack-london-summary
1q84-haruki-murakami-summary
the-stars-like-dust-isaac-asimov-summary
you-are-not-so-smart-david-mcraney-summary
the-new-life-orhan-pamuk-summary
sharp-objects-gillian-flynn-summary
twisted-lies-ana-huang-summary
the-millionaire-fastlane-m-j-demarco-summary
the-body-bill-bryson-summary
zero-to-sold-arvid-kahl-summary
grant-ron-chernow-summary
how-to-decide-annie-duke-summary
mrs-dalloway-virginia-woolf-summary
the-first-90-days-michael-d-watkins-summary
disciplined-entrepreneurship-bill-aulet-summary
wicked-gregory-maguire-summary
a-tale-of-love-and-darkness-amos-oz-summary
baudolino-umberto-eco-summary
the-merchant-of-venice-william-shakespeare-summary
mastery-robert-greene-summary
the-door-magda-szabo-summary
they-both-die-at-the-end-adam-silvera-summary
carrie-stephen-king-summary
use-of-weapons-iain-m-banks-summary
cannery-row-john-steinbeck-summary
the-stepford-wives-ira-levin-summary
a-history-of-western-philosophy-bertrand-russell-summary
dark-matter-blake-crouch-summary
a-theory-of-justice-john-rawls-summary
built-to-last-jim-collins-summary
the-lost-world-michael-crichton-summary
if-on-a-winter-s-night-a-traveler-italo-calvino-summary
built-to-sell-john-warrillow-summary
the-book-of-laughter-and-forgetting-milan-kundera-summary
the-brothers-karamazov-fyodor-dostoevsky-summary
the-lost-daughter-elena-ferrante-summary
ignited-minds-a-p-j-abdul-kalam-summary
the-girl-on-the-train-paula-hawkins-summary
everybody-writes-ann-handley-summary
kafka-on-the-shore-haruki-murakami-summary
the-raven-edgar-allan-poe-summary
the-road-cormac-mccarthy-summary
the-gods-themselves-isaac-asimov-summary
behave-robert-m-sapolsky-summary
ancillary-sword-ann-leckie-summary
margin-of-safety-seth-a-klarman-summary
how-to-live-on-24-hours-a-day-arnold-bennett-summary
the-dead-zone-stephen-king-summary
nights-of-plague-orhan-pamuk-summary
the-diary-of-a-ceo-steven-bartlett-summary
women-who-love-too-much-robin-norwood-summary
mistakes-were-made-but-not-by-me-carol-tavris-summary
the-decameron-giovanni-boccaccio-summary
seabiscuit-laura-hillenbrand-summary
like-water-for-chocolate-laura-esquivel-summary
11-22-63-stephen-king-summary
what-my-bones-know-stephanie-foo-summary
rose-madder-stephen-king-summary
ensaio-sobre-a-cegueira-jose-saramago-summary
sunrise-on-the-reaping-suzanne-collins-summary
glucose-revolution-jessie-inchauspe-summary
powerless-lauren-roberts-summary
the-cat-in-the-hat-dr-seuss-summary
nature-ralph-waldo-emerson-summary
hopscotch-julio-cortazar-summary
the-invention-of-morel-adolfo-bioy-casares-summary
lilith-george-macdonald-summary
the-solitude-of-prime-numbers-paolo-giordano-summary
playing-for-pizza-john-grisham-summary
chinese-cinderella-adeline-yen-mah-summary
the-kill-order-james-dashner-summary
marketing-made-simple-donald-miller-summary
the-halloween-tree-ray-bradbury-summary
the-troop-nick-cutter-summary
i-m-glad-my-mom-died-jennette-mccurdy-summary
owl-moon-jane-yolen-summary
five-go-adventuring-again-enid-blyton-summary
woman-at-point-zero-nawal-el-saadawi-summary
mickey7-edward-ashton-summary
cursed-bunny-bora-chung-summary
designing-brand-identity-alina-wheeler-summary
digital-marketing-strategy-simon-kingsnorth-summary
transformational-leadership-bernard-m-bass-summary
strategic-market-management-david-a-aaker-summary
""".strip().split()


_SMALL = {
    "a", "an", "the", "of", "and", "in", "on", "to", "for", "or", "but",
    "nor", "as", "at", "by", "from", "with", "vs", "via", "into", "over",
}
_PARTICLES = {
    "de", "da", "van", "von", "del", "della", "di", "le", "la", "el", "al",
    "bin", "ibn", "st", "saint", "mc", "mac", "du", "des", "der", "den",
}
_ROMAN = {"ii", "iii", "iv", "vi", "vii", "viii", "ix", "xl"}

_CAT_HINTS: list[tuple[str, tuple[str, ...]]] = [
    ("Mystery & Thriller", (
        "murder", "mystery", "thriller", "housemaid", "gone girl", "poe",
        "christie", "king", "talisman", "cujo", "christine", "carrie",
        "sharp objects", "girl on the train", "silent patient", "troop",
    )),
    ("Romance", (
        "love", "twisted", "romance", "wedding", "notebook", "call me",
        "normal people", "spanish love",
    )),
    ("Fantasy", (
        "silmarillion", "hobbit", "mistborn", "kings", "brisingr",
        "sanderson", "goodkind", "hobb", "sutherland", "eragon", "wizard",
        "powerless", "lilith",
    )),
    ("Science Fiction", (
        "asimov", "foundation", "clarke", "odyssey", "dune", "ishiguro",
        "dick", "scalzi", "watts", "okorafor", "murakami", "dark matter",
        "ancillary", "mickey7", "use of weapons", "neuromancer", "martian",
        "ender", "klara",
    )),
    ("Philosophy", (
        "philosoph", "stoic", "liberty", "tao", "sartre", "camus",
        "russell", "mill", "seneca", "plato", "rawls", "nietzsche",
        "consolations", "moral sentiments", "abolition of man",
    )),
    ("Psychology", (
        "psycholog", "brain", "mind", "thinking", "emotion", "jung",
        "freud", "damasio", "sapolsky", "behave", "persuasion", "influence",
        "mistakes were made", "you are not so smart",
    )),
    ("Leadership", (
        "leader", "executive", "drucker", "covey", "greenleaf",
        "first 90 days", "transformational",
    )),
    ("Business", (
        "startup", "market", "lean", "toyota", "buffett", "invest",
        "money", "wealth", "sales", "copywrit", "e-myth", "hormozi",
        "entrepreneur", "brand", "venture", "keynes", "fastlane",
        "zero to sold", "built to", "choice factory", "everybody writes",
        "diary of a ceo",
    )),
    ("Productivity", (
        "focus", "time", "gtd", "sprint", "productiv", "24 hours",
        "make time", "hyperfocus",
    )),
    ("Biography", (
        "hamilton", "elon", "jobs", "malala", "becoming", "kalam",
        "wings of fire", "feynman", "grant", "chernow", "isaacson",
        "i m glad my mom", "seabiscuit",
    )),
    ("History", (
        "history", "rome", "spqr", "war", "civilization", "gulag",
    )),
    ("Self-Help", (
        "habit", "success", "heal", "untamed", "ikigai", "cheese",
        "goggins", "manson", "artist", "badass", "subtle art",
        "you can heal",
    )),
    ("Classic Literature", (
        "dickens", "austen", "hugo", "shakespeare", "dostoevsky",
        "tolstoy", "orwell", "proust", "balzac", "twain", "woolf",
        "steinbeck", "mccarthy", "calvino", "eco", "kundera", "goethe",
        "boccaccio", "london", "poe", "carroll", "seuss",
    )),
]


def _titlecase(parts: list[str]) -> str:
    out: list[str] = []
    for i, p in enumerate(parts):
        if not p:
            continue
        if p == "s" and out:
            out[-1] = out[-1] + "'s"
            continue
        if i > 0 and p in _SMALL:
            out.append(p)
        elif p in _ROMAN:
            out.append(p.upper())
        elif p in {"mr", "mrs", "dr", "st"}:
            out.append(p.capitalize() + ".")
        else:
            out.append(p.capitalize())
    return " ".join(out)


def guess_category(title: str, core: str) -> str:
    blob = f"{title} {core}".lower()
    for category, needles in _CAT_HINTS:
        if any(re.search(rf"\b{re.escape(n)}\b", blob) for n in needles):
            return category
    return "General"


def parse_english_slug(raw: str) -> dict | None:
    """Turn a live `/books/{slug}-summary` URL or slug into a catalog row."""
    s = raw.strip().lower()
    s = re.sub(r"^https?://[^/]+/books/", "", s)
    s = s.strip("/")
    s = re.sub(r"20\d{2}-\d{2}-\d{2}.*$", "", s)
    if "hindi-summary" in s or s.endswith("-saransh") or s.endswith("-सारांश"):
        return None
    if not re.fullmatch(r"[a-z0-9-]+", s):
        return None
    if not s.endswith("-summary"):
        return None
    core = s[: -len("-summary")]
    parts = [p for p in core.split("-") if p]
    if len(parts) < 2:
        return None
    n = len(parts)
    one_word = {
        "ikigai", "dune", "neuromancer", "siddhartha", "meditations", "walden",
        "frankenstein", "hamlet", "macbeth", "beloved", "educated", "becoming",
        "grit", "mindset", "quiet", "flow", "nudge", "rework", "hooked",
        "sprint", "drive", "rest", "peak", "influence", "noise", "antifragile",
        "principles", "essentialism", "effortless", "hyperfocus", "indistractable",
        "ultralearning", "blindsight", "carrie", "cujo", "christine", "twilight",
        "brisingr", "mistborn", "foundation", "doglapan", "seabiscuit", "wicked",
        "baudolino", "mastery", "behave", "hopscotch", "lilith", "powerless",
        "accelerate", "outliers", "spqr", "attached", "nausea", "emma", "untamed",
        "evicted", "persepolis", "doglapan", "grant",
    }
    if n >= 3 and parts[0] in one_word:
        take = n - 1
    else:
        take = 2 if n >= 3 else 1
        # Penultimate initial: daniel-j-levitin / j-r-r-tolkien
        if n >= 4 and len(parts[-2]) == 1:
            take = 3
            k = 3
            while take < n - 1 and len(parts[-k]) == 1:
                take += 1
                k += 1
        while take < min(6, n - 1):
            nxt = parts[n - take - 1]
            if nxt in _PARTICLES or nxt == "and":
                take += 1
                continue
            break
        # Don't leave a lone "the/a/an" as the title
        if n - take == 1 and parts[0] in _SMALL and n >= 4:
            take = n - 2
    take = min(max(take, 1), n - 1)
    title = _titlecase(parts[:-take])
    author = _titlecase(parts[-take:])
    if not title or title.lower() in _SMALL:
        title = _titlecase(parts[:-1])
        author = _titlecase(parts[-1:])
    if not title or title.lower() in _SMALL:
        return None
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    if len(slug) < 4:
        return None
    return {
        "title": title,
        "author": author or "Unknown",
        "category": guess_category(title, core),
        "slug": slug,
        "source_slug": core,
    }


_GLUE = _SMALL | {"my", "your", "his", "her", "its", "our", "their"}


def is_seed_title_author(src: str, seed_slug: str) -> bool:
    """True when sitemap slug is `{seed-title}-{author}`, not a longer different title."""
    if not src or not seed_slug or not src.startswith(seed_slug + "-"):
        return False
    tokens = [t for t in src[len(seed_slug) + 1 :].split("-") if t]
    if not tokens or any(t in _GLUE for t in tokens):
        return False
    n, L = len(tokens), len(seed_slug)
    if n <= 2:
        return True
    if n == 3 and L >= 7:
        return True
    if n <= 6 and L >= 10:
        return True
    return False


def extra_books() -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for raw in EXTRA_SLUGS:
        item = parse_english_slug(raw if raw.endswith("-summary") else f"{raw}-summary")
        if not item or item["slug"] in seen:
            continue
        seen.add(item["slug"])
        out.append(item)
    return out
