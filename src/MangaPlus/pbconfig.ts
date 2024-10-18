import { 
    ContentRating, 
    SourceIntents 
} from '@paperback/types'

export default {
    icon: 'icon.png',
    name: 'MangaPlus',
    version: '2.0.3',
    description: 'Extension that pulls manga from Manga+ by Shueisha',
    contentRating: ContentRating.EVERYONE,
    developers: [
        {
            name: 'Yves Pa',
            github: 'https://github.com/YvesPa/webtoons-extensions'
        },
        {
            name: 'Rinto-kun',
            github: 'https://github.com/Rinto-kun'
        }
    ],
    badges: [],
    capabilities: [
        SourceIntents.MANGA_CHAPTERS,
        SourceIntents.HOMEPAGE_SECTIONS,
        SourceIntents.SETTINGS_UI,
        SourceIntents.MANGA_SEARCH
    ]
}