/**
 * Zyrex Scenepack IMDb & Productions Hub
 * Curated Registry of Movies & Series popular in the editing community.
 */

var IMDB_PRODUCTIONS = [
    {
        id: "stranger-things",
        imdbId: "tt4574334",
        title: "Stranger Things",
        year: "2016\u20132025",
        type: "Series",
        rating: "8.7",
        rotten: "83%",
        directors: "Ross Duffer, Matt Duffer",
        genres: "Sci-Fi, Mystery, Action, Drama",
        cast: "Millie Bobby Brown, Finn Wolfhard, Winona Ryder, David Harbour, Joe Keery, Sadie Sink",
        tagline: "It only gets stranger...",
        poster: "https://m.media-amazon.com/images/M/MV5BMDZkNjE3MmQtNjUxZS00OTkyLWE4NjQtM2Y2ZGE4YmRhNWM4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200",
        keywords: ["stranger things", "steve harrington", "will byers", "eleven", "hawkins", "eddie munson", "max mayfield", "billy hargrove", "robin buckley", "nancy wheeler", "hopper"]
    },
    {
        id: "euphoria",
        imdbId: "tt8772296",
        title: "Euphoria",
        year: "2019\u2013",
        type: "Series",
        rating: "8.3",
        rotten: "88%",
        directors: "Sam Levinson",
        genres: "Drama, Romance",
        cast: "Zendaya, Sydney Sweeney, Hunter Schafer, Jacob Elordi, Alexa Demie, Maude Apatow",
        tagline: "Remember this feeling.",
        poster: "https://m.media-amazon.com/images/M/MV5BN2U2YmFhNDQtYWI5Ni00NmEyLTk1YzktYzg0MGNkNDk3NmRlXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200",
        keywords: ["euphoria", "rue bennett", "cassie howard", "maddy perez", "nate jacobs", "jules vaughn", "fezco", "lexi howard"]
    },
    {
        id: "breaking-bad",
        imdbId: "tt0903747",
        title: "Breaking Bad",
        year: "2008\u20132013",
        type: "Series",
        rating: "9.5",
        rotten: "96%",
        directors: "Vince Gilligan",
        genres: "Crime, Drama, Thriller",
        cast: "Bryan Cranston, Aaron Paul, Bob Odenkirk, Anna Gunn, Dean Norris, Giancarlo Esposito",
        tagline: "Change the equation.",
        poster: "https://m.media-amazon.com/images/M/MV5BYmQ4YWMxYjUtNjZmYi00MDQ1LWFjMjAtNjA5MonitorXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["breaking bad", "walter white", "heisenberg", "jesse pinkman", "gus fring", "saul goodman", "hank schrader", "mike ehrmantraut"]
    },
    {
        id: "spider-man-across-the-spider-verse",
        imdbId: "tt9362722",
        title: "Spider-Man: Across the Spider-Verse",
        year: "2023",
        type: "Movie",
        rating: "8.7",
        rotten: "95%",
        directors: "Joaquim Dos Santos, Kemp Powers",
        genres: "Animation, Action, Adventure",
        cast: "Shameik Moore, Hailee Steinfeld, Oscar Isaac, Daniel Kaluuya, Jake Johnson",
        tagline: "It's how you wear the mask that matters.",
        poster: "https://m.media-amazon.com/images/M/MV5BMzI0NmVkMjEtYmY4MS00ZDMxLTlkZmEtMzU4MDQxYTMzMjU2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200",
        keywords: ["spider-man", "spiderman", "spider-verse", "spiderverse", "miles morales", "gwen stacy", "miguel o'hara", "spider-punk", "hobie brown"]
    },
    {
        id: "the-batman",
        imdbId: "tt1877830",
        title: "The Batman",
        year: "2022",
        type: "Movie",
        rating: "7.8",
        rotten: "85%",
        directors: "Matt Reeves",
        genres: "Action, Crime, Drama",
        cast: "Robert Pattinson, Zo\u00eb Kravitz, Paul Dano, Jeffrey Wright, Colin Farrell",
        tagline: "Unmask the truth.",
        poster: "https://m.media-amazon.com/images/M/MV5BMDdmMTBiNTYtMGMzYS00ODU4LWEzNTUtNzBiYWBiYzA5N2UxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200",
        keywords: ["the batman", "batman", "bruce wayne", "robert pattinson", "riddler", "catwoman", "selina kyle", "penguin", "gotham"]
    },
    {
        id: "peaky-blinders",
        imdbId: "tt2442560",
        title: "Peaky Blinders",
        year: "2013\u20132022",
        type: "Series",
        rating: "8.8",
        rotten: "93%",
        directors: "Steven Knight",
        genres: "Crime, Drama",
        cast: "Cillian Murphy, Paul Anderson, Helen McCrory, Tom Hardy, Sophie Rundle",
        tagline: "No fighting.",
        poster: "https://m.media-amazon.com/images/M/MV5BMjA3NTEwOTMxMV5BMl5BanBnXkFtZTgwMDMyODgxMzI@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
        keywords: ["peaky blinders", "thomas shelby", "tommy shelby", "arthur shelby", "alfie solomons", "cillian murphy", "shelby"]
    },
    {
        id: "oppenheimer",
        imdbId: "tt15398776",
        title: "Oppenheimer",
        year: "2023",
        type: "Movie",
        rating: "8.9",
        rotten: "93%",
        directors: "Christopher Nolan",
        genres: "Biography, Drama, History",
        cast: "Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr., Florence Pugh",
        tagline: "The world forever changes.",
        poster: "https://m.media-amazon.com/images/M/MV5BMDBmYTZjNjUtN2M1MS00MTQ2LTk2ODgtNzc2M2QyZGE5NTVjXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200",
        keywords: ["oppenheimer", "j. robert oppenheimer", "christopher nolan", "manhattan project", "cillian murphy"]
    },
    {
        id: "fight-club",
        imdbId: "tt0137523",
        title: "Fight Club",
        year: "1999",
        type: "Movie",
        rating: "8.8",
        rotten: "80%",
        directors: "David Fincher",
        genres: "Drama",
        cast: "Brad Pitt, Edward Norton, Helena Bonham Carter, Meat Loaf, Jared Leto",
        tagline: "Mischief. Mayhem. Soap.",
        poster: "https://m.media-amazon.com/images/M/MV5BOTgyOGQ1NDItNGU3Ny00MjU3LTg2YTQtNmIzMS00N2I0ZDU1NjA2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["fight club", "tyler durden", "the narrator", "marla singer", "brad pitt", "edward norton"]
    },
    {
        id: "the-boys",
        imdbId: "tt1190634",
        title: "The Boys",
        year: "2019\u2013",
        type: "Series",
        rating: "8.7",
        rotten: "93%",
        directors: "Eric Kripke",
        genres: "Action, Comedy, Crime, Sci-Fi",
        cast: "Karl Urban, Jack Quaid, Antony Starr, Erin Moriarty, Jensen Ackles",
        tagline: "Never meet your heroes.",
        poster: "https://m.media-amazon.com/images/M/MV5BYzA2Nzk5M2EtNWY4Yi00ZDY4LThkZTgtYjhhNmM4N2Y1MzA0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200",
        keywords: ["the boys", "homelander", "billy butcher", "hughie campbell", "soldier boy", "antony starr", "vought"]
    },
    {
        id: "jujutsu-kaisen",
        imdbId: "tt12343534",
        title: "Jujutsu Kaisen",
        year: "2020\u2013",
        type: "Series",
        rating: "8.5",
        rotten: "98%",
        directors: "Sunghoo Park, Shota Goshozono",
        genres: "Animation, Action, Fantasy",
        cast: "Junya Enoki, Yuma Uchida, Asami Seto, Yuichi Nakamura",
        tagline: "To defeat curses, you must become one.",
        poster: "https://m.media-amazon.com/images/M/MV5BNGY4MTg3NzgtMmFkZi00NTg5LWExMmEtMWI3YzI1ODdmMWQ1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200",
        keywords: ["jujutsu kaisen", "jjk", "gojo", "gojo satoru", "sukuna", "itadori yuji", "megumi fushiguro", "toji fushiguro", "geto suguru"]
    },
    {
        id: "attack-on-titan",
        imdbId: "tt2560140",
        title: "Attack on Titan",
        year: "2013\u20132023",
        type: "Series",
        rating: "9.1",
        rotten: "95%",
        directors: "Tetsuro Araki, Yuichiro Hayashi",
        genres: "Animation, Action, Adventure, Drama",
        cast: "Yuki Kaji, Yui Ishikawa, Marina Inoue, Hiroshi Kamiya",
        tagline: "Fight or die.",
        poster: "https://m.media-amazon.com/images/M/MV5BZjJlYTc1ODUtYjE4Mi00MThkLWFmYTQtZTNiYjg4MTgzNGQ0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200",
        keywords: ["attack on titan", "aot", "shingeki no kyojin", "eren yeager", "levi ackerman", "mikasa ackerman", "erwin smith"]
    },
    {
        id: "american-psycho",
        imdbId: "tt0144084",
        title: "American Psycho",
        year: "2000",
        type: "Movie",
        rating: "7.6",
        rotten: "68%",
        directors: "Mary Harron",
        genres: "Crime, Drama, Horror",
        cast: "Christian Bale, Justin Theroux, Josh Lucas, Chloe Sevigny, Willem Dafoe",
        tagline: "No explanation. No remorse. Just business.",
        poster: "https://m.media-amazon.com/images/M/MV5BM2MyZTRhOTAtYWMzYS00OWU0LTkyNWQtYzc1MTY1OTg0OGViXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
        keywords: ["american psycho", "patrick bateman", "christian bale"]
    },
    {
        id: "blade-runner-2049",
        imdbId: "tt1856101",
        title: "Blade Runner 2049",
        year: "2017",
        type: "Movie",
        rating: "8.0",
        rotten: "88%",
        directors: "Denis Villeneuve",
        genres: "Action, Drama, Mystery, Sci-Fi",
        cast: "Ryan Gosling, Harrison Ford, Ana de Armas, Sylvia Hoeks, Robin Wright",
        tagline: "The key to the future is finally unearthed.",
        poster: "https://m.media-amazon.com/images/M/MV5BNzA1Njg4NzYxOV5BMl5BanBnXkFtZTgwODk5NjU3MzI@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["blade runner", "blade runner 2049", "officer k", "ryan gosling", "joi", "ana de armas"]
    },
    {
        id: "dune-part-two",
        imdbId: "tt15239678",
        title: "Dune: Part Two",
        year: "2024",
        type: "Movie",
        rating: "8.6",
        rotten: "92%",
        directors: "Denis Villeneuve",
        genres: "Action, Adventure, Drama, Sci-Fi",
        cast: "Timoth\u00e9e Chalamet, Zendaya, Rebecca Ferguson, Javier Bardem, Austin Butler",
        tagline: "Long live the fighters.",
        poster: "https://m.media-amazon.com/images/M/MV5BN2QyZGU4ZDctOWMzMy00NTc5LThlOGQtODhmNDI1NmY5YzAwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200",
        keywords: ["dune", "dune 2", "paul atreides", "timothee chalamet", "feyd-rautha", "austin butler", "chani"]
    },
    {
        id: "succession",
        imdbId: "tt7660850",
        title: "Succession",
        year: "2018\u20132023",
        type: "Series",
        rating: "8.9",
        rotten: "95%",
        directors: "Jesse Armstrong",
        genres: "Comedy, Drama",
        cast: "Brian Cox, Jeremy Strong, Sarah Snook, Kieran Culkin, Matthew Macfadyen",
        tagline: "Make your move.",
        poster: "https://m.media-amazon.com/images/M/MV5BNTY4YjgyZDctYTJjOC00N2EzLWE0NGUtYTQyMWYyNDlhMmQ4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200",
        keywords: ["succession", "kendall roy", "logan roy", "roman roy", "shiv roy", "tom wambsgans"]
    },
    {
        id: "arcane",
        imdbId: "tt11126994",
        title: "Arcane",
        year: "2021–2024",
        type: "Series",
        rating: "9.0",
        rotten: "100%",
        directors: "Christian Linke, Alex Yee",
        genres: "Animation, Action, Adventure, Sci-Fi",
        cast: "Hailee Steinfeld, Ella Purnell, Kevin Alejandro, Katie Leung",
        tagline: "Every legend has a beginning.",
        poster: "https://m.media-amazon.com/images/M/MV5BYmU5OWM5ZTAtNjUzOC00NmUyLTgyOWMtMjlkMbkwOTY0MzMwXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        banner: "https://images.unsplash.com/photo-1563089145-599997674d42?w=1200",
        keywords: ["arcane", "jinx", "silco", "caitlyn", "zaun", "piltover", "heimerdinger", "vi arcane", "arcane league"]
    }
];

var GAME_PRODUCTIONS = [
    {
        id: "elden-ring",
        title: "Elden Ring",
        year: "2022",
        type: "Game",
        category: "game",
        rating: "9.5",
        directors: "FromSoftware",
        genres: "Action RPG, Dark Fantasy",
        cast: "Malenia, Radahn, Ranni, Marika, Godfrey, Melina",
        tagline: "Rise, Tarnished.",
        poster: "https://media.rawg.io/media/games/b29/b294fdd866dcdb643e7bab370a552855.jpg",
        banner: "https://media.rawg.io/media/games/b29/b294fdd866dcdb643e7bab370a552855.jpg",
        keywords: ["elden ring", "malenia", "radahn", "ranni", "tarnished", "shadow of the erdtree"]
    },
    {
        id: "resident-evil",
        title: "Resident Evil",
        year: "1996–Present",
        type: "Game",
        category: "game",
        rating: "9.2",
        directors: "Capcom",
        genres: "Survival Horror, Action, Sci-Fi",
        cast: "Leon S. Kennedy, Ada Wong, Claire Redfield, Jill Valentine, Chris Redfield, Albert Wesker",
        tagline: "Enter the world of survival horror.",
        poster: "https://thumbnail.zyrexediting.xyz/4921935510176045.jpeg",
        banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200",
        keywords: ["resident evil", "ada wong", "code: veronica", "code veronica", "claire redfield", "leon kennedy", "leon s. kennedy", "jill valentine", "chris redfield", "albert wesker", "biohazard", "raccoon city", "umbrella corp", "battlesuit", "veronica"]
    },
    {
        id: "gta",
        title: "Grand Theft Auto",
        year: "1997–Present",
        type: "Game",
        category: "game",
        rating: "9.5",
        directors: "Rockstar Games",
        genres: "Action-Adventure, Open World, Crime",
        cast: "Michael De Santa, Franklin Clinton, Trevor Philips, Tommy Vercetti, CJ",
        tagline: "Welcome to Los Santos.",
        poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["gta", "grand theft auto", "gta v", "gta 5", "gta vi", "gta 6", "los santos", "trevor philips", "michael de santa", "franklin clinton", "san andreas"]
    },
    {
        id: "cyberpunk-2077",
        title: "Cyberpunk 2077",
        year: "2020",
        type: "Game",
        category: "game",
        rating: "8.6",
        directors: "CD Projekt Red",
        genres: "Action RPG, Sci-Fi, Cyberpunk",
        cast: "V, Johnny Silverhand, Judy Alvarez, Panam Palmer",
        tagline: "Welcome to Night City.",
        poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["cyberpunk", "cyberpunk 2077", "johnny silverhand", "night city", "panam", "judy alvarez"]
    },
    {
        id: "valorant",
        title: "Valorant",
        year: "2020",
        type: "Game",
        category: "game",
        rating: "8.5",
        directors: "Riot Games",
        genres: "First-Person Shooter, Tactical",
        cast: "Jett, Reyna, Phoenix, Viper, Sage, Omen",
        tagline: "Defy the limits.",
        poster: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200",
        banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
        keywords: ["valorant", "jett", "reyna", "phoenix", "sage", "omen", "clove"]
    },
    {
        id: "minecraft",
        title: "Minecraft",
        year: "2011",
        type: "Game",
        category: "game",
        rating: "9.0",
        directors: "Mojang Studios",
        genres: "Sandbox, Survival, Adventure",
        cast: "Steve, Alex, Ender Dragon",
        tagline: "Build, survive, explore.",
        poster: "https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg",
        banner: "https://media.rawg.io/media/games/b4e/b4e4c73d5aa4ec66bbf75375c4847a2b.jpg",
        keywords: ["minecraft", "steve", "mojang", "ender dragon"]
    },
    {
        id: "god-of-war",
        title: "God of War",
        year: "2018",
        type: "Game",
        category: "game",
        rating: "9.7",
        directors: "Santa Monica Studio",
        genres: "Action-Adventure, Mythology",
        cast: "Kratos, Atreus, Freya, Baldur, Thor",
        tagline: "A new beginning.",
        poster: "https://media.rawg.io/media/games/4be/4be6a6ad03647293dc2f6d5da4019756.jpg",
        banner: "https://media.rawg.io/media/games/4be/4be6a6ad03647293dc2f6d5da4019756.jpg",
        keywords: ["god of war", "kratos", "atreus", "ragnarok"]
    },
    {
        id: "red-dead-redemption-2",
        title: "Red Dead Redemption 2",
        year: "2018",
        type: "Game",
        category: "game",
        rating: "9.8",
        directors: "Rockstar Games",
        genres: "Action-Adventure, Western",
        cast: "Arthur Morgan, Dutch van der Linde, John Marston, Sadie Adler",
        tagline: "Outlaws for life.",
        poster: "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg",
        banner: "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg",
        keywords: ["red dead", "red dead redemption", "rdr2", "arthur morgan", "john marston"]
    }
];

function slugifyText(text) {
    if (!text) return '';
    return String(text).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function findProductionForScenepack(item) {
    if (!item) return null;
    var cat = (item.category || '').toLowerCase().trim();
    var isGame = (cat === 'games' || cat === 'game');
    var isAnime = (cat === 'anime');
    var isMovie = (cat === 'movie');
    var isSeries = (cat === 'series');

    var origin = (item.origin || '').trim();
    var name = (item.name || item.title || '').trim();
    var nameLower = name.toLowerCase();

    // 1. PRIORITY ONE: If explicit origin is provided, match by origin ONLY!
    if (origin) {
        var originLower = origin.toLowerCase();
        var originSlug = slugifyText(origin);

        // Check in games if item is marked as game
        if (isGame) {
            for (var g = 0; g < GAME_PRODUCTIONS.length; g++) {
                var gp = GAME_PRODUCTIONS[g];
                if (gp.title.toLowerCase() === originLower || gp.id === originSlug) {
                    return gp;
                }
            }
        } else {
            // Check in IMDb productions
            for (var m = 0; m < IMDB_PRODUCTIONS.length; m++) {
                var ip = IMDB_PRODUCTIONS[m];
                if (ip.title.toLowerCase() === originLower || ip.id === originSlug) {
                    return ip;
                }
            }
            // Also check games just in case category was not set
            for (var g2 = 0; g2 < GAME_PRODUCTIONS.length; g2++) {
                var gp2 = GAME_PRODUCTIONS[g2];
                if (gp2.title.toLowerCase() === originLower || gp2.id === originSlug) {
                    return gp2;
                }
            }
        }

        // Return honest dynamic production for custom origin
        return {
            id: originSlug || 'custom-origin',
            title: origin,
            year: item.release_date ? item.release_date.split('-')[0] : '',
            type: isGame ? 'Game' : (isSeries ? 'Series' : (isMovie ? 'Movie' : (isAnime ? 'Anime' : 'Production'))),
            category: isGame ? 'game' : (cat || 'production'),
            rating: item.rating || item.imdb_rating || '',
            rotten: '',
            directors: isGame ? 'Game Studio' : 'Director',
            genres: isGame ? 'Video Game' : (cat ? cat.toUpperCase() : 'Film/TV'),
            cast: '',
            tagline: '',
            poster: (item.thumbnail && !item.thumbnail.includes('content.png')) ? item.thumbnail : '/assets/content.png',
            banner: (item.thumbnail && !item.thumbnail.includes('content.png')) ? item.thumbnail : '',
            keywords: [originLower],
            isDynamic: true
        };
    }

    // 2. PRIORITY TWO: If no explicit origin, match by known title or distinct keywords
    if (isGame) {
        for (var g3 = 0; g3 < GAME_PRODUCTIONS.length; g3++) {
            var gp3 = GAME_PRODUCTIONS[g3];
            var tLow = gp3.title.toLowerCase();
            if (nameLower.indexOf(tLow) !== -1) {
                return gp3;
            }
            if (gp3.keywords && Array.isArray(gp3.keywords)) {
                for (var k = 0; k < gp3.keywords.length; k++) {
                    var kw = gp3.keywords[k].toLowerCase();
                    if (kw.length >= 4 && nameLower.indexOf(kw) !== -1) {
                        return gp3;
                    }
                }
            }
        }
    } else {
        for (var m2 = 0; m2 < IMDB_PRODUCTIONS.length; m2++) {
            var ip2 = IMDB_PRODUCTIONS[m2];
            var iLow = ip2.title.toLowerCase();
            if (nameLower.indexOf(iLow) !== -1) {
                return ip2;
            }
            if (ip2.keywords && Array.isArray(ip2.keywords)) {
                for (var k2 = 0; k2 < ip2.keywords.length; k2++) {
                    var kw2 = ip2.keywords[k2].toLowerCase();
                    if (kw2.length >= 4 && nameLower.indexOf(kw2) !== -1) {
                        return ip2;
                    }
                }
            }
        }
    }

    return null;
}

function getAllIMDbProductions() {
    return IMDB_PRODUCTIONS;
}

function getAllGameProductions() {
    return GAME_PRODUCTIONS;
}

function getAllProductions() {
    return IMDB_PRODUCTIONS.concat(GAME_PRODUCTIONS);
}

function getProductionById(id, itemsList) {
    if (!id) return null;
    var target = String(id).toLowerCase().trim();
    var all = IMDB_PRODUCTIONS.concat(GAME_PRODUCTIONS);
    for (var i = 0; i < all.length; i++) {
        if (all[i].id === target || (all[i].imdbId && all[i].imdbId.toLowerCase() === target)) {
            return all[i];
        }
    }
    // Also search dynamic productions in itemsList or window.allSP
    var list = (itemsList && Array.isArray(itemsList)) ? itemsList : (typeof allSP !== 'undefined' && Array.isArray(allSP) ? allSP : []);
    for (var j = 0; j < list.length; j++) {
        var item = list[j];
        var prod = findProductionForScenepack(item);
        if (prod && (prod.id === target || slugifyText(prod.title) === target || prod.title.toLowerCase() === target)) {
            return prod;
        }
    }
    return null;
}
