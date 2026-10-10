"""English catalog: 300+ titles. Extra fields only where we have book-specific notes."""

from __future__ import annotations

# (title, author, category)
SEED: list[tuple[str, str, str]] = []

def _add(category: str, rows: list[tuple[str, str]]) -> None:
    for title, author in rows:
        SEED.append((title, author, category))


_add("Self-Help", [
    ("Atomic Habits", "James Clear"),
    ("The 7 Habits of Highly Effective People", "Stephen R. Covey"),
    ("The Subtle Art of Not Giving a F*ck", "Mark Manson"),
    ("How to Win Friends and Influence People", "Dale Carnegie"),
    ("How to Stop Worrying and Start Living", "Dale Carnegie"),
    ("Think and Grow Rich", "Napoleon Hill"),
    ("The Magic of Thinking Big", "David J. Schwartz"),
    ("Awaken the Giant Within", "Tony Robbins"),
    ("The Success Principles", "Jack Canfield"),
    ("Make Your Bed", "William H. McRaven"),
    ("Can't Hurt Me", "David Goggins"),
    ("Never Finished", "David Goggins"),
    ("Discipline Equals Freedom", "Jocko Willink"),
    ("The Compound Effect", "Darren Hardy"),
    ("The Slight Edge", "Jeff Olson"),
    ("Tiny Habits", "BJ Fogg"),
    ("Better Than Before", "Gretchen Rubin"),
    ("The Happiness Project", "Gretchen Rubin"),
    ("The Four Agreements", "Don Miguel Ruiz"),
    ("The Fifth Agreement", "Don Miguel Ruiz"),
    ("You Are a Badass", "Jen Sincero"),
    ("Daring Greatly", "Brené Brown"),
    ("The Gifts of Imperfection", "Brené Brown"),
    ("Rising Strong", "Brené Brown"),
    ("Atlas of the Heart", "Brené Brown"),
    ("The Mountain Is You", "Brianna Wiest"),
    ("101 Essays That Will Change the Way You Think", "Brianna Wiest"),
    ("The Comfort Book", "Matt Haig"),
    ("Reasons to Stay Alive", "Matt Haig"),
    ("Feel-Good Productivity", "Ali Abdaal"),
    ("The Art of Impossible", "Steven Kotler"),
    ("The Gap and The Gain", "Dan Sullivan"),
    ("10x Is Easier Than 2x", "Dan Sullivan"),
    ("The 5 AM Club", "Robin Sharma"),
    ("The Monk Who Sold His Ferrari", "Robin Sharma"),
    ("The Miracle Morning", "Hal Elrod"),
    ("Eat That Frog!", "Brian Tracy"),
    ("No Excuses!", "Brian Tracy"),
    ("As a Man Thinketh", "James Allen"),
    ("The Science of Getting Rich", "Wallace D. Wattles"),
    ("The Power of Positive Thinking", "Norman Vincent Peale"),
    ("Man's Search for Himself", "Rollo May"),
    ("The Road Less Traveled", "M. Scott Peck"),
    ("The Untethered Soul", "Michael A. Singer"),
    ("The Surrender Experiment", "Michael A. Singer"),
    ("The Power of Now", "Eckhart Tolle"),
    ("A New Earth", "Eckhart Tolle"),
    ("The Alchemist", "Paulo Coelho"),
])

_add("Productivity", [
    ("Deep Work", "Cal Newport"),
    ("Digital Minimalism", "Cal Newport"),
    ("So Good They Can't Ignore You", "Cal Newport"),
    ("Slow Productivity", "Cal Newport"),
    ("Essentialism", "Greg McKeown"),
    ("Effortless", "Greg McKeown"),
    ("Getting Things Done", "David Allen"),
    ("The ONE Thing", "Gary Keller"),
    ("Eat That Frog!", "Brian Tracy"),
    ("Indistractable", "Nir Eyal"),
    ("Hooked", "Nir Eyal"),
    ("Hyperfocus", "Chris Bailey"),
    ("The Productivity Project", "Chris Bailey"),
    ("Free to Focus", "Michael Hyatt"),
    ("Make Time", "Jake Knapp"),
    ("Sprint", "Jake Knapp"),
    ("The Now Habit", "Neil Fiore"),
    ("168 Hours", "Laura Vanderkam"),
    ("Off the Clock", "Laura Vanderkam"),
    ("Four Thousand Weeks", "Oliver Burkeman"),
    ("The Antidote", "Oliver Burkeman"),
    ("When", "Daniel H. Pink"),
    ("Drive", "Daniel H. Pink"),
    ("A Whole New Mind", "Daniel H. Pink"),
    ("Rest", "Alex Soojung-Kim Pang"),
    ("Why We Sleep", "Matthew Walker"),
    ("Peak", "Anders Ericsson"),
    ("The Art of Learning", "Josh Waitzkin"),
    ("Ultralearning", "Scott H. Young"),
    ("A Mind for Numbers", "Barbara Oakley"),
])

_add("Psychology", [
    ("Thinking, Fast and Slow", "Daniel Kahneman"),
    ("Noise", "Daniel Kahneman"),
    ("The Power of Habit", "Charles Duhigg"),
    ("Smarter Faster Better", "Charles Duhigg"),
    ("Emotional Intelligence", "Daniel Goleman"),
    ("Focus", "Daniel Goleman"),
    ("Social Intelligence", "Daniel Goleman"),
    ("Mindset", "Carol S. Dweck"),
    ("Grit", "Angela Duckworth"),
    ("Influence", "Robert B. Cialdini"),
    ("Pre-Suasion", "Robert B. Cialdini"),
    ("The Body Keeps the Score", "Bessel van der Kolk"),
    ("Thinking in Bets", "Annie Duke"),
    ("Quit", "Annie Duke"),
    ("Predictably Irrational", "Dan Ariely"),
    ("The Upside of Irrationality", "Dan Ariely"),
    ("The Art of Thinking Clearly", "Rolf Dobelli"),
    ("The Righteous Mind", "Jonathan Haidt"),
    ("The Happiness Hypothesis", "Jonathan Haidt"),
    ("The Coddling of the American Mind", "Jonathan Haidt"),
    ("Flow", "Mihaly Csikszentmihalyi"),
    ("Quiet", "Susan Cain"),
    ("Bittersweet", "Susan Cain"),
    ("Attached", "Amir Levine"),
    ("Presence", "Amy Cuddy"),
    ("Presence (Csikszentmihalyi)", "Mihaly Csikszentmihalyi"),
    ("Behave", "Robert M. Sapolsky"),
    ("Why Zebras Don't Get Ulcers", "Robert M. Sapolsky"),
    ("The Man Who Mistook His Wife for a Hat", "Oliver Sacks"),
    ("Incognito", "David Eagleman"),
    ("The Brain That Changes Itself", "Norman Doidge"),
    ("Stumbling on Happiness", "Daniel Gilbert"),
    ("Happiness by Design", "Paul Dolan"),
    ("Authentic Happiness", "Martin E. P. Seligman"),
    ("Learned Optimism", "Martin E. P. Seligman"),
    ("Flourish", "Martin E. P. Seligman"),
    ("The Paradox of Choice", "Barry Schwartz"),
    ("Blink", "Malcolm Gladwell"),
    ("Outliers", "Malcolm Gladwell"),
    ("The Tipping Point", "Malcolm Gladwell"),
    ("Talking to Strangers", "Malcolm Gladwell"),
    ("David and Goliath", "Malcolm Gladwell"),
    ("Factfulness", "Hans Rosling"),
    ("Mistakes Were Made (But Not by Me)", "Carol Tavris"),
    ("The Lucifer Effect", "Philip Zimbardo"),
    ("Obedience to Authority", "Stanley Milgram"),
    ("Games People Play", "Eric Berne"),
    ("I'm OK — You're OK", "Thomas A. Harris"),
])

_add("Business", [
    ("Zero to One", "Peter Thiel"),
    ("The Lean Startup", "Eric Ries"),
    ("The Hard Thing About Hard Things", "Ben Horowitz"),
    ("Good to Great", "Jim Collins"),
    ("Built to Last", "Jim Collins"),
    ("Great by Choice", "Jim Collins"),
    ("Blue Ocean Strategy", "W. Chan Kim"),
    ("The E-Myth Revisited", "Michael E. Gerber"),
    ("High Output Management", "Andrew S. Grove"),
    ("Only the Paranoid Survive", "Andrew S. Grove"),
    ("The Innovator's Dilemma", "Clayton M. Christensen"),
    ("Crossing the Chasm", "Geoffrey A. Moore"),
    ("Measure What Matters", "John Doerr"),
    ("Rework", "Jason Fried"),
    ("It Doesn't Have to Be Crazy at Work", "Jason Fried"),
    ("Traction", "Gino Wickman"),
    ("The Mom Test", "Rob Fitzpatrick"),
    ("The Personal MBA", "Josh Kaufman"),
    ("The Goal", "Eliyahu M. Goldratt"),
    ("The Phoenix Project", "Gene Kim"),
    ("Inspired", "Marty Cagan"),
    ("Empowered", "Marty Cagan"),
    ("Made to Stick", "Chip Heath"),
    ("Switch", "Chip Heath"),
    ("Decisive", "Chip Heath"),
    ("Contagious", "Jonah Berger"),
    ("Building a StoryBrand", "Donald Miller"),
    ("This Is Marketing", "Seth Godin"),
    ("Purple Cow", "Seth Godin"),
    ("The Dip", "Seth Godin"),
    ("Never Split the Difference", "Chris Voss"),
    ("Getting to Yes", "Roger Fisher"),
    ("Start With Why", "Simon Sinek"),
    ("The Infinite Game", "Simon Sinek"),
    ("Leaders Eat Last", "Simon Sinek"),
    ("Radical Candor", "Kim Scott"),
    ("Crucial Conversations", "Kerry Patterson"),
    ("The Five Dysfunctions of a Team", "Patrick Lencioni"),
    ("Death by Meeting", "Patrick Lencioni"),
    ("Who", "Geoff Smart"),
    ("Creativity, Inc.", "Ed Catmull"),
    ("Shoe Dog", "Phil Knight"),
    ("The Everything Store", "Brad Stone"),
    ("Sam Walton: Made in America", "Sam Walton"),
    ("Delivering Happiness", "Tony Hsieh"),
    ("The Ride of a Lifetime", "Robert Iger"),
    ("No Rules Rules", "Reed Hastings"),
    ("Blitzscaling", "Reid Hoffman"),
    ("The Cold Start Problem", "Andrew Chen"),
    ("The Almanack of Naval Ravikant", "Eric Jorgenson"),
    ("Poor Charlie's Almanack", "Charlie Munger"),
    ("Amp It Up", "Frank Slootman"),
    ("Play Bigger", "Al Ramadan"),
    ("Obviously Awesome", "April Dunford"),
    ("Positioning", "Al Ries"),
    ("The 22 Immutable Laws of Marketing", "Al Ries"),
    ("Crossing the Chasm 3rd", "Geoffrey A. Moore"),
    ("Business Model Generation", "Alexander Osterwalder"),
    ("Value Proposition Design", "Alexander Osterwalder"),
    ("The Startup Owner's Manual", "Steve Blank"),
    ("Four Steps to the Epiphany", "Steve Blank"),
    ("Venture Deals", "Brad Feld"),
    ("The Creative Act", "Rick Rubin"),
])

_add("Finance", [
    ("Rich Dad Poor Dad", "Robert T. Kiyosaki"),
    ("The Psychology of Money", "Morgan Housel"),
    ("Same as Ever", "Morgan Housel"),
    ("The Intelligent Investor", "Benjamin Graham"),
    ("The Little Book of Common Sense Investing", "John C. Bogle"),
    ("A Random Walk Down Wall Street", "Burton G. Malkiel"),
    ("The Richest Man in Babylon", "George S. Clason"),
    ("The Millionaire Next Door", "Thomas J. Stanley"),
    ("I Will Teach You to Be Rich", "Ramit Sethi"),
    ("Your Money or Your Life", "Vicki Robin"),
    ("The Total Money Makeover", "Dave Ramsey"),
    ("The Simple Path to Wealth", "J. L. Collins"),
    ("A Random Walk", "Burton G. Malkiel"),
    ("One Up On Wall Street", "Peter Lynch"),
    ("Beating the Street", "Peter Lynch"),
    ("The Essays of Warren Buffett", "Warren Buffett"),
    ("Security Analysis", "Benjamin Graham"),
    ("The Most Important Thing", "Howard Marks"),
    ("Fooled by Randomness", "Nassim Nicholas Taleb"),
    ("The Black Swan", "Nassim Nicholas Taleb"),
    ("Antifragile", "Nassim Nicholas Taleb"),
    ("Skin in the Game", "Nassim Nicholas Taleb"),
    ("Principles", "Ray Dalio"),
    ("The Changing World Order", "Ray Dalio"),
    ("The Ascent of Money", "Niall Ferguson"),
    ("Capital in the Twenty-First Century", "Thomas Piketty"),
    ("Freakonomics", "Steven D. Levitt"),
    ("SuperFreakonomics", "Steven D. Levitt"),
    ("Misbehaving", "Richard H. Thaler"),
    ("Nudge", "Richard H. Thaler"),
    ("Poor Economics", "Abhijit V. Banerjee"),
    ("When Genius Failed", "Roger Lowenstein"),
    ("Liar's Poker", "Michael Lewis"),
    ("The Big Short", "Michael Lewis"),
    ("Flash Boys", "Michael Lewis"),
    ("Moneyball", "Michael Lewis"),
    ("The Undoing Project", "Michael Lewis"),
    ("Barbarians at the Gate", "Bryan Burrough"),
    ("Against the Gods", "Peter L. Bernstein"),
    ("The Little Book That Beats the Market", "Joel Greenblatt"),
])

_add("Leadership", [
    ("Extreme Ownership", "Jocko Willink"),
    ("The Dichotomy of Leadership", "Jocko Willink"),
    ("Turn the Ship Around!", "L. David Marquet"),
    ("Good to Great", "Jim Collins"),
    ("The 21 Irrefutable Laws of Leadership", "John C. Maxwell"),
    ("Developing the Leader Within You", "John C. Maxwell"),
    ("Leaders Eat Last", "Simon Sinek"),
    ("Dare to Lead", "Brené Brown"),
    ("Multipliers", "Liz Wiseman"),
    ("The Coaching Habit", "Michael Bungay Stanier"),
    ("The First 90 Days", "Michael D. Watkins"),
    ("What Got You Here Won't Get You There", "Marshall Goldsmith"),
    ("Triggers", "Marshall Goldsmith"),
    ("Primal Leadership", "Daniel Goleman"),
    ("The Leadership Challenge", "James M. Kouzes"),
    ("On Becoming a Leader", "Warren Bennis"),
    ("Leadership", "Doris Kearns Goodwin"),
    ("Team of Teams", "Stanley McChrystal"),
    ("Call Sign Chaos", "Jim Mattis"),
    ("It's Your Ship", "D. Michael Abrashoff"),
])

_add("Philosophy", [
    ("Meditations", "Marcus Aurelius"),
    ("Letters from a Stoic", "Seneca"),
    ("Discourses and Selected Writings", "Epictetus"),
    ("The Daily Stoic", "Ryan Holiday"),
    ("The Obstacle Is the Way", "Ryan Holiday"),
    ("Ego Is the Enemy", "Ryan Holiday"),
    ("Stillness Is the Key", "Ryan Holiday"),
    ("Courage Is Calling", "Ryan Holiday"),
    ("A Guide to the Good Life", "William B. Irvine"),
    ("How to Think Like a Roman Emperor", "Donald Robertson"),
    ("Man's Search for Meaning", "Viktor E. Frankl"),
    ("The Myth of Sisyphus", "Albert Camus"),
    ("The Prophet", "Kahlil Gibran"),
    ("Siddhartha", "Hermann Hesse"),
    ("Tao Te Ching", "Lao Tzu"),
    ("The Art of War", "Sun Tzu"),
    ("Bhagavad Gita", "Vyasa"),
    ("The Upanishads", "Anonymous"),
    ("Chanakya Niti", "Chanakya"),
    ("The Book of Five Rings", "Miyamoto Musashi"),
    ("Walden", "Henry David Thoreau"),
    ("Self-Reliance", "Ralph Waldo Emerson"),
    ("The Republic", "Plato"),
    ("Nicomachean Ethics", "Aristotle"),
    ("Beyond Good and Evil", "Friedrich Nietzsche"),
    ("Thus Spoke Zarathustra", "Friedrich Nietzsche"),
    ("Being and Time", "Martin Heidegger"),
    ("The Stranger", "Albert Camus"),
    ("The Consolation of Philosophy", "Boethius"),
    ("Pensées", "Blaise Pascal"),
])

_add("Spirituality", [
    ("The Power of Now", "Eckhart Tolle"),
    ("A New Earth", "Eckhart Tolle"),
    ("The Four Agreements", "Don Miguel Ruiz"),
    ("Bhagavad Gita", "Vyasa"),
    ("Autobiography of a Yogi", "Paramahansa Yogananda"),
    ("The Untethered Soul", "Michael A. Singer"),
    ("Wherever You Go, There You Are", "Jon Kabat-Zinn"),
    ("The Miracle of Mindfulness", "Thich Nhat Hanh"),
    ("Peace Is Every Step", "Thich Nhat Hanh"),
    ("The Seat of the Soul", "Gary Zukav"),
    ("Conversations with God", "Neale Donald Walsch"),
    ("The Book of Joy", "Dalai Lama"),
    ("When Things Fall Apart", "Pema Chödrön"),
    ("The Wisdom of Insecurity", "Alan Watts"),
    ("The Way of Zen", "Alan Watts"),
])

_add("Biography", [
    ("Wings of Fire", "A. P. J. Abdul Kalam"),
    ("Long Walk to Freedom", "Nelson Mandela"),
    ("The Story of My Experiments with Truth", "M. K. Gandhi"),
    ("The Autobiography of Malcolm X", "Malcolm X"),
    ("Steve Jobs", "Walter Isaacson"),
    ("Einstein", "Walter Isaacson"),
    ("Leonardo da Vinci", "Walter Isaacson"),
    ("Benjamin Franklin", "Walter Isaacson"),
    ("Elon Musk", "Walter Isaacson"),
    ("The Wright Brothers", "David McCullough"),
    ("Team of Rivals", "Doris Kearns Goodwin"),
    ("Becoming", "Michelle Obama"),
    ("Educated", "Tara Westover"),
    ("Born a Crime", "Trevor Noah"),
    ("I Am Malala", "Malala Yousafzai"),
    ("When Breath Becomes Air", "Paul Kalanithi"),
    ("The Last Lecture", "Randy Pausch"),
    ("Open", "Andre Agassi"),
    ("The Glass Castle", "Jeannette Walls"),
    ("Wild", "Cheryl Strayed"),
    ("Unbroken", "Laura Hillenbrand"),
    ("Endurance", "Alfred Lansing"),
    ("Into Thin Air", "Jon Krakauer"),
    ("Into the Wild", "Jon Krakauer"),
    ("The Boys in the Boat", "Daniel James Brown"),
    ("Night", "Elie Wiesel"),
    ("Anne Frank: The Diary of a Young Girl", "Anne Frank"),
    ("I Know Why the Caged Bird Sings", "Maya Angelou"),
    ("Surely You're Joking, Mr. Feynman!", "Richard P. Feynman"),
    ("My Life and Work", "Henry Ford"),
])

_add("History", [
    ("Sapiens", "Yuval Noah Harari"),
    ("Homo Deus", "Yuval Noah Harari"),
    ("21 Lessons for the 21st Century", "Yuval Noah Harari"),
    ("Guns, Germs, and Steel", "Jared Diamond"),
    ("Collapse", "Jared Diamond"),
    ("The Silk Roads", "Peter Frankopan"),
    ("Why Nations Fail", "Daron Acemoglu"),
    ("Prisoners of Geography", "Tim Marshall"),
    ("A People's History of the United States", "Howard Zinn"),
    ("SPQR", "Mary Beard"),
    ("1491", "Charles C. Mann"),
    ("The Warmth of Other Suns", "Isabel Wilkerson"),
    ("Caste", "Isabel Wilkerson"),
    ("The Rise and Fall of the Third Reich", "William L. Shirer"),
    ("Postwar", "Tony Judt"),
    ("The Better Angels of Our Nature", "Steven Pinker"),
    ("Enlightenment Now", "Steven Pinker"),
    ("A Short History of Nearly Everything", "Bill Bryson"),
    ("Salt: A World History", "Mark Kurlansky"),
    ("The Origins of Political Order", "Francis Fukuyama"),
])

_add("Science", [
    ("A Brief History of Time", "Stephen Hawking"),
    ("The Grand Design", "Stephen Hawking"),
    ("Cosmos", "Carl Sagan"),
    ("Pale Blue Dot", "Carl Sagan"),
    ("The Demon-Haunted World", "Carl Sagan"),
    ("The Selfish Gene", "Richard Dawkins"),
    ("The Blind Watchmaker", "Richard Dawkins"),
    ("The Gene", "Siddhartha Mukherjee"),
    ("The Emperor of All Maladies", "Siddhartha Mukherjee"),
    ("The Immortal Life of Henrietta Lacks", "Rebecca Skloot"),
    ("The Body", "Bill Bryson"),
    ("Seven Brief Lessons on Physics", "Carlo Rovelli"),
    ("The Order of Time", "Carlo Rovelli"),
    ("The Structure of Scientific Revolutions", "Thomas S. Kuhn"),
    ("Gödel, Escher, Bach", "Douglas Hofstadter"),
    ("Scale", "Geoffrey West"),
    ("Chaos", "James Gleick"),
    ("The Code Breaker", "Walter Isaacson"),
    ("Breath", "James Nestor"),
    ("The Song of the Cell", "Siddhartha Mukherjee"),
])

_add("Classic Literature", [
    ("1984", "George Orwell"),
    ("Animal Farm", "George Orwell"),
    ("Brave New World", "Aldous Huxley"),
    ("Fahrenheit 451", "Ray Bradbury"),
    ("To Kill a Mockingbird", "Harper Lee"),
    ("The Great Gatsby", "F. Scott Fitzgerald"),
    ("Pride and Prejudice", "Jane Austen"),
    ("Jane Eyre", "Charlotte Brontë"),
    ("Wuthering Heights", "Emily Brontë"),
    ("Hamlet", "William Shakespeare"),
    ("Macbeth", "William Shakespeare"),
    ("Romeo and Juliet", "William Shakespeare"),
    ("King Lear", "William Shakespeare"),
    ("Othello", "William Shakespeare"),
    ("The Odyssey", "Homer"),
    ("The Iliad", "Homer"),
    ("Crime and Punishment", "Fyodor Dostoevsky"),
    ("The Brothers Karamazov", "Fyodor Dostoevsky"),
    ("Anna Karenina", "Leo Tolstoy"),
    ("War and Peace", "Leo Tolstoy"),
    ("Moby-Dick", "Herman Melville"),
    ("Catch-22", "Joseph Heller"),
    ("Slaughterhouse-Five", "Kurt Vonnegut"),
    ("The Catcher in the Rye", "J. D. Salinger"),
    ("Of Mice and Men", "John Steinbeck"),
    ("The Grapes of Wrath", "John Steinbeck"),
    ("Lord of the Flies", "William Golding"),
    ("The Stranger", "Albert Camus"),
    ("The Trial", "Franz Kafka"),
    ("One Hundred Years of Solitude", "Gabriel García Márquez"),
    ("Things Fall Apart", "Chinua Achebe"),
    ("Beloved", "Toni Morrison"),
    ("Invisible Man", "Ralph Ellison"),
    ("The Kite Runner", "Khaled Hosseini"),
    ("Life of Pi", "Yann Martel"),
    ("The God of Small Things", "Arundhati Roy"),
    ("Midnight's Children", "Salman Rushdie"),
    ("The White Tiger", "Aravind Adiga"),
    ("A Suitable Boy", "Vikram Seth"),
    ("Interpreter of Maladies", "Jhumpa Lahiri"),
])

_add("Mystery & Thriller", [
    ("And Then There Were None", "Agatha Christie"),
    ("Murder on the Orient Express", "Agatha Christie"),
    ("The Hound of the Baskervilles", "Arthur Conan Doyle"),
    ("The Girl with the Dragon Tattoo", "Stieg Larsson"),
    ("Gone Girl", "Gillian Flynn"),
    ("The Silent Patient", "Alex Michaelides"),
    ("The Da Vinci Code", "Dan Brown"),
    ("The Bourne Identity", "Robert Ludlum"),
    ("The Spy Who Came in from the Cold", "John le Carré"),
    ("Tinker Tailor Soldier Spy", "John le Carré"),
])

_add("Fantasy", [
    ("The Hobbit", "J. R. R. Tolkien"),
    ("The Lord of the Rings", "J. R. R. Tolkien"),
    ("A Game of Thrones", "George R. R. Martin"),
    ("The Name of the Wind", "Patrick Rothfuss"),
    ("The Lion, the Witch and the Wardrobe", "C. S. Lewis"),
    ("Mistborn", "Brandon Sanderson"),
    ("The Way of Kings", "Brandon Sanderson"),
    ("American Gods", "Neil Gaiman"),
    ("Good Omens", "Neil Gaiman"),
    ("Jonathan Strange & Mr Norrell", "Susanna Clarke"),
])

_add("Science Fiction", [
    ("Dune", "Frank Herbert"),
    ("Foundation", "Isaac Asimov"),
    ("Neuromancer", "William Gibson"),
    ("The Left Hand of Darkness", "Ursula K. Le Guin"),
    ("Do Androids Dream of Electric Sheep?", "Philip K. Dick"),
    ("The Hitchhiker's Guide to the Galaxy", "Douglas Adams"),
    ("Ender's Game", "Orson Scott Card"),
    ("The Martian", "Andy Weir"),
    ("Project Hail Mary", "Andy Weir"),
    ("Ready Player One", "Ernest Cline"),
    ("Frankenstein", "Mary Shelley"),
    ("1984", "George Orwell"),
    ("Brave New World", "Aldous Huxley"),
    ("Fahrenheit 451", "Ray Bradbury"),
    ("Snow Crash", "Neal Stephenson"),
])

_add("Romance", [
    ("Pride and Prejudice", "Jane Austen"),
    ("Jane Eyre", "Charlotte Brontë"),
    ("Persuasion", "Jane Austen"),
    ("Emma", "Jane Austen"),
    ("Outlander", "Diana Gabaldon"),
    ("The Notebook", "Nicholas Sparks"),
    ("Me Before You", "Jojo Moyes"),
    ("Normal People", "Sally Rooney"),
    ("Call Me by Your Name", "André Aciman"),
    ("The Time Traveler's Wife", "Audrey Niffenegger"),
])


def _slug(title: str) -> str:
    import re
    s = title.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:80]


# Book-specific notes (short, source-faithful). Used when present; otherwise lenses.
CONTENT: dict[str, dict] = {
    "atomic-habits": {
        "tagline": "Tiny changes, remarkable results — identity is built by what you repeat.",
        "overview": "You do not rise to your goals. You fall to your systems. Small habits compound into identity.",
        "key_ideas": "- **Identity first** — every action is a vote for who you are.\n- **Cue craving response reward** — design each of the four.\n- **Four Laws** — make it obvious, attractive, easy, satisfying.\n- **2-minute rule** — shrink it until you cannot skip it.\n- **Environment design** — friction decides more than motivation.",
        "daily_application": "- Pick one identity sentence.\n- Stack a 2-minute habit after coffee.\n- Never miss twice.\n- Track the streak.",
    },
    "deep-work": {
        "tagline": "The ability to focus without distraction is the new superpower.",
        "overview": "Deep work is rare and valuable. Shallow work fills the day unless you protect long focus blocks.",
        "key_ideas": "- Deep vs shallow work\n- Attention residue\n- Ritualize start and shutdown\n- Quit social media by default",
        "daily_application": "- Block 90 minutes tomorrow.\n- Phone in another room.\n- Measure output not activity.",
    },
    "thinking-fast-and-slow": {
        "tagline": "Your mind has two speeds — know which one is steering.",
        "overview": "System 1 is fast intuition. System 2 is slow reason. Biases live in the gap between them.",
        "key_ideas": "- System 1 vs System 2\n- Loss aversion\n- Anchoring\n- WYSIATI\n- The outside view",
    },
    "the-psychology-of-money": {
        "tagline": "Doing well with money is behavior, not intelligence.",
        "overview": "Enough is a strategy. Survival beats brilliance. Time is the quiet partner of wealth.",
        "key_ideas": "- Compounding\n- Room for error\n- Tail events\n- Independence as the goal\n- Getting rich and staying rich are different skills",
    },
    "rich-dad-poor-dad": {
        "tagline": "The rich buy assets. The poor buy liabilities that feel like assets.",
        "overview": "Financial literacy is the real school. Your job is a start, not a finish.",
        "key_ideas": "- Asset vs liability\n- Cashflow\n- Pay yourself first\n- Learn the language of money",
    },
    "sapiens": {
        "tagline": "We rule the earth because we believe the same stories.",
        "overview": "Homo sapiens scales cooperation through shared myths — money, gods, nations, limited companies.",
        "key_ideas": "- Cognitive revolution\n- Agricultural revolution\n- Imagined orders\n- Money as mutual trust",
    },
    "meditations": {
        "tagline": "Waste no more time arguing what a good man should be. Be one.",
        "overview": "Private notes of an emperor: control judgment, do your duty, remember you will die.",
        "key_ideas": "- Dichotomy of control\n- View from above\n- Amor fati\n- The inner citadel",
    },
    "mans-search-for-meaning": {
        "tagline": "He who has a why can bear almost any how.",
        "overview": "Meaning can be found in any condition. The last freedom is the attitude you choose.",
        "key_ideas": "- Logotherapy\n- Will to meaning\n- Tragic optimism\n- Responsibility",
    },
    "the-7-habits-of-highly-effective-people": {
        "tagline": "Character before personality. Principles outlast tactics.",
        "overview": "Effectiveness is inside-out. Private victory precedes public victory. Habits 1-3 build independence; 4-6 interdependence; 7 renewal.",
        "key_ideas": "- Be proactive\n- Begin with the end in mind\n- Put first things first\n- Think win-win\n- Seek first to understand\n- Synergize\n- Sharpen the saw",
        "daily_application": "- Write weekly roles and goals.\n- One win-win conversation.\n- 30 minutes to sharpen the saw.",
    },
    "how-to-win-friends-and-influence-people": {
        "tagline": "To be interesting, be interested — and mean it.",
        "overview": "People crave sincere importance. Influence starts with genuine interest, not argument.",
        "key_ideas": "- Don't criticize, condemn, or complain\n- Give honest appreciation\n- Be genuinely interested\n- Remember names\n- Talk in terms of the other person's interests",
    },
    "the-power-of-habit": {
        "tagline": "You cannot kill a habit — you can only replace the routine.",
        "overview": "Habits run on a loop: cue, routine, reward. Keep the cue and reward; swap the routine.",
        "key_ideas": "- Habit loop\n- Keystone habits\n- Craving as engine\n- Golden rule of change\n- Willpower as a muscle",
    },
    "essentialism": {
        "tagline": "The way of the essentialist is the way of the editor.",
        "overview": "If it isn't a clear yes, it is a no. Less but better. Trade-offs are the work.",
        "key_ideas": "- Disciplined pursuit of less\n- Explore then eliminate\n- Set boundaries\n- Design buffers\n- One priority at a time",
    },
    "digital-minimalism": {
        "tagline": "Use the internet on your terms — or it will use you.",
        "overview": "Cluttered apps steal attention. Minimalism is intentional use in service of values.",
        "key_ideas": "- 30-day digital declutter\n- Solitude deprivation\n- High-quality leisure\n- Reintroduce only what serves",
    },
    "thinking-in-bets": {
        "tagline": "Better decisions come from treating beliefs as bets, not certainties.",
        "overview": "We judge decisions by outcomes, but luck hides the truth. Hold every belief with a probability.",
        "key_ideas": "- Resulting is the trap\n- Beliefs are bets\n- Pre-mortems\n- Truth-seeking groups",
    },
    "emotional-intelligence": {
        "tagline": "What you feel is data — what you do with it is character.",
        "overview": "IQ is not destiny. EQ — awareness, regulation, empathy, social skill — predicts life outcomes.",
        "key_ideas": "- Self-awareness\n- Self-regulation\n- Motivation\n- Empathy\n- Social skill\n- The amygdala hijack",
    },
    "mindset": {
        "tagline": "Talent is a starting point. Belief about talent decides the rest.",
        "overview": "A fixed mindset avoids challenge. A growth mindset treats effort as the path.",
        "key_ideas": "- Fixed vs growth\n- Yet as a word\n- Praise process not gift\n- Failure as information",
    },
    "grit": {
        "tagline": "Passion plus perseverance outruns raw talent.",
        "overview": "Grit is stamina toward a long goal. Interest, practice, purpose, hope.",
        "key_ideas": "- Effort counts twice\n- Deliberate practice\n- Purpose beyond the self\n- Grit can be grown",
    },
    "influence": {
        "tagline": "Persuasion has levers — know them to use them, and to resist them.",
        "overview": "Six principles of influence: reciprocity, commitment, social proof, liking, authority, scarcity.",
        "key_ideas": "- Reciprocity\n- Commitment and consistency\n- Social proof\n- Liking\n- Authority\n- Scarcity",
    },
    "zero-to-one": {
        "tagline": "Don't copy. Go from 0 to 1. Monopoly is the reward of uniqueness.",
        "overview": "Vertical progress creates something new. Competition is for losers if you can build a monopoly on a secret.",
        "key_ideas": "- Contrarian question\n- Secrets\n- Last mover advantage\n- Definite optimism\n- Start small and monopolize",
    },
    "the-lean-startup": {
        "tagline": "Validated learning beats expensive guesses.",
        "overview": "Build-measure-learn. Ship a minimum viable product. Pivot or persevere on evidence.",
        "key_ideas": "- MVP\n- Build-measure-learn\n- Innovation accounting\n- Pivot vs persevere",
    },
    "blue-ocean-strategy": {
        "tagline": "The best fight is the one you make unnecessary.",
        "overview": "Stop fighting in red oceans. Create uncontested space through value innovation.",
        "key_ideas": "- Red vs blue ocean\n- ERRC grid\n- Strategy canvas\n- Hunt noncustomers",
    },
    "good-to-great": {
        "tagline": "Level 5 leaders, a hedgehog, and a flywheel — not a miracle moment.",
        "overview": "Great companies get the right people, confront facts, and push a simple flywheel for years.",
        "key_ideas": "- Level 5 leadership\n- First who then what\n- Stockdale paradox\n- Hedgehog concept\n- Flywheel not doom loop",
    },
    "the-intelligent-investor": {
        "tagline": "The market is a partner who is often wrong. Use that.",
        "overview": "Mr. Market is manic. Margin of safety and the difference between investing and speculating are the whole art.",
        "key_ideas": "- Mr. Market\n- Margin of safety\n- Investing vs speculating\n- Intrinsic value",
    },
    "the-obstacle-is-the-way": {
        "tagline": "The obstacle is not in the way. It is the way.",
        "overview": "Perception, action, will. What stands in the way becomes the way.",
        "key_ideas": "- Objective perception\n- Right action\n- Inner will\n- Amor fati",
    },
    "ego-is-the-enemy": {
        "tagline": "Ego destroys in aspiration, success, and failure alike.",
        "overview": "Stay a student. Talk less, do more. Ego inflates at every stage unless you starve it.",
        "key_ideas": "- Be a student\n- Work, don't talk\n- Success is a test\n- Failure is a teacher",
    },
    "wings-of-fire": {
        "tagline": "A small island boy, a large national fire — built by work.",
        "overview": "Kalam's life: Rameswaram, scholarship, ISRO, missiles, and teaching. Dream, then endure.",
        "key_ideas": "- Vision with sweat\n- Team over ego\n- Failure as fuel\n- Science as service",
    },
    "a-brief-history-of-time": {
        "tagline": "The cosmos is stranger than myth — and still speakable in human language.",
        "overview": "The universe has a history. Time is not absolute. We can still ask where it all began.",
        "key_ideas": "- Big Bang\n- Black holes\n- Arrow of time\n- Quantum meets gravity",
    },
    "factfulness": {
        "tagline": "The world is bad, better, and improvable — all three at once.",
        "overview": "Ten dramatic instincts distort data. Factfulness is a calm habit of checking the numbers.",
        "key_ideas": "- Gap instinct\n- Negativity instinct\n- Straight-line instinct\n- Fear and urgency\n- Most people live in the middle",
    },
    "1984": {
        "tagline": "Who controls the past controls the future. Who controls the present controls the past.",
        "overview": "A surveillance state rewrites language and memory until dissent cannot even be thought.",
        "key_ideas": "- Newspeak\n- Doublethink\n- Big Brother\n- The two minutes hate\n- Freedom is the freedom to say 2+2=4",
    },
    "animal-farm": {
        "tagline": "All animals are equal, but some animals are more equal than others.",
        "overview": "A revolution against tyranny becomes the thing it replaced. Language does the laundering.",
        "key_ideas": "- The seven commandments\n- Napoleon vs Snowball\n- Boxer's loyalty\n- The rewritten past",
    },
    "getting-things-done": {
        "tagline": "Your mind is for having ideas, not holding them.",
        "overview": "Capture everything, clarify the next action, review weekly. Stress is open loops.",
        "key_ideas": "- Capture\n- Clarify\n- Organize\n- Reflect\n- Engage\n- Next-action thinking",
    },
    "the-one-thing": {
        "tagline": "What's the one thing such that by doing it, everything else gets easier or unnecessary?",
        "overview": "Success is sequential. Time-block the one thing. Multitasking is a tax.",
        "key_ideas": "- Focusing question\n- Domino effect\n- Time blocking\n- Say no",
    },
    "start-with-why": {
        "tagline": "People don't buy what you do. They buy why you do it.",
        "overview": "The golden circle: why, how, what. Leaders speak from the inside out.",
        "key_ideas": "- Golden circle\n- Why how what\n- The split between leaders and those who lead",
    },
    "never-split-the-difference": {
        "tagline": "Negotiation is not logic. It is tactical empathy.",
        "overview": "FBI hostage skills for the boardroom: mirrors, labels, no as a start, calibrated questions.",
        "key_ideas": "- Mirrors\n- Labeling\n- Accusation audit\n- Calibrated questions\n- That's right, not you're right",
    },
    "the-alchemist": {
        "tagline": "When you want something, all the universe conspires in helping you to achieve it.",
        "overview": "Santiago leaves the known flock to chase a Personal Legend. The treasure was also at home — but only after the journey.",
        "key_ideas": "- Personal Legend\n- Language of the world\n- Fear of failure\n- Beginner's omens",
    },
    "dune": {
        "tagline": "The spice must flow — and fear is the mind-killer.",
        "overview": "Arrakis, ecology, prophecy, and power. Paul Atreides walks a path he both chooses and is chosen by.",
        "key_ideas": "- Fear is the mind-killer\n- Desert power\n- Ecology as destiny\n- The trap of messiahs",
    },
}


def load_books(extra_json: str | None = None) -> list[dict]:
    """Dedupe by slug. Extra JSON may add or override fields."""
    from extra_slugs import extra_books, is_seed_title_author

    seen: set[str] = set()
    books: list[dict] = []
    for title, author, category in SEED:
        slug = _slug(title)
        if slug in seen:
            continue
        seen.add(slug)
        row = {"title": title, "author": author, "category": category, "slug": slug}
        row.update(CONTENT.get(slug, {}))
        books.append(row)
    for item in extra_books():
        slug = item.get("slug") or _slug(item.get("title") or "")
        if not slug or slug in seen or len(slug) < 4:
            continue
        src = item.get("source_slug") or ""
        if src and any(is_seed_title_author(src, s) for s in seen):
            continue
        seen.add(slug)
        item.setdefault("slug", slug)
        item.update(CONTENT.get(slug, {}))
        books.append(item)
    if extra_json:
        import json
        from pathlib import Path
        payload = json.loads(Path(extra_json).read_text(encoding="utf-8"))
        rows = payload if isinstance(payload, list) else payload.get("books", [])
        for item in rows:
            slug = item.get("slug") or _slug(item.get("title") or "")
            if not slug:
                continue
            if slug in seen:
                for b in books:
                    if b["slug"] == slug:
                        b.update({k: v for k, v in item.items() if v})
                        break
            else:
                seen.add(slug)
                item.setdefault("slug", slug)
                books.append(item)
    return books
