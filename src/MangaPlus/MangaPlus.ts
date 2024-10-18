import {
    SourceManga,
    Chapter,
    ChapterDetails,
    PagedResults,
    Request,
    Response,
    SearchResultsProviding,
    ChapterProviding,
    Extension,
    SettingsFormProviding,
    BasicRateLimiter,
    DiscoverSectionType,
    Form,
    SearchQuery,
    SearchResultItem,
    DiscoverSection
} from '@paperback/types'

import {
    langPopup,
    Language,
    MangaPlusResponse,
    TitleDetailView
} from './MangaPlusHelper'

import {
    getLanguages,
    getResolution,
    getSplitImages,
    MangaPlusSettingForm
} from './MangaPlusSettings'

const BASE_URL = 'https://mangaplus.shueisha.co.jp'
const API_URL = 'https://jumpg-webapi.tokyo-cdn.com/api'

const langCode = Language.ENGLISH

export class MangaPlusSource implements Extension, SearchResultsProviding, ChapterProviding, SettingsFormProviding {
    globalRateLimiter = new BasicRateLimiter('rateLimiter', {numberOfRequests: 10, bufferInterval: 1, ignoreImages: true})

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    constructor() {}

    async initialise(): Promise<void> {
        console.log('MangaPlus Extension has been initialised')
        this.registerInterceptors()
        this.registerDiscoverSections()
    }

    async getMangaDetails(mangaId: string): Promise<SourceManga> {
        const request = {
            url: `${API_URL}/title_detailV3?title_id=${mangaId}&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = TitleDetailView.fromJson(Application.arrayBufferToUTF8String(response))

        return result.toSourceManga()
    }

    private async getThumbnailUrl(mangaId: string): Promise<string> {
        const request = {
            url: `${API_URL}/title_detailV3?title_id=${mangaId}&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = TitleDetailView.fromJson(Application.arrayBufferToUTF8String(response))
        
        return result.title?.portraitImageUrl ?? ''
    }

    async getChapters(sourceManga: SourceManga): Promise<Chapter[]> {
        const request = {
            url: `${API_URL}/title_detailV3?title_id=${sourceManga.mangaId}&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = TitleDetailView.fromJson(Application.arrayBufferToUTF8String(response))

        return [...(result.firstChapterList ?? []), ...(result.lastChapterList ?? [])].reverse().filter(chapter => !chapter.isExpired).map(chapter => chapter.toSChapter(sourceManga))
    }

    async getChapterDetails(chapter: Chapter): Promise<ChapterDetails> {
        const request = {
            url: `${API_URL}/manga_viewer?chapter_id=${chapter.chapterId}&split=${getSplitImages()}&img_quality=${getResolution()}&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = JSON.parse(Application.arrayBufferToUTF8String(response)) as MangaPlusResponse

        if (result.success === undefined) {
            throw new Error(langPopup(result.error, Language.ENGLISH)?.body ?? 'Unknown error')
        }

        const pages = result.success.mangaViewer?.pages
            .map(page => page.mangaPage)
            .filter(page => page)
            .map((page) => page?.encryptionKey ? `${page?.imageUrl}#${page?.encryptionKey}` : '')

        return {
            id: chapter.chapterId,
            mangaId: chapter.sourceManga.mangaId,
            pages: pages ?? []
        }

    }

    async getFeaturedTitles(section: DiscoverSection, metadata: any | undefined) : Promise<PagedResults<SearchResultItem>> {
        const request = {
            url: `${API_URL}/featuredV2?lang=eng&clang=eng&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = JSON.parse(Application.arrayBufferToUTF8String(response)) as MangaPlusResponse

        if (result.success === undefined) {
            throw new Error(langPopup(result.error, Language.ENGLISH)?.body ?? 'Unknown error')
        }

        const languages = await getLanguages()

        const results = result.success?.featuredTitlesViewV2?.contents?.find(x => x.titleList && x.titleList.listName == 'WEEKLY SHONEN JUMP')?.titleList.featuredTitles
            .filter((title) => languages.includes(title.language ?? Language.ENGLISH))

        const titles: SearchResultItem[] = []
        const collectedIds: string[] = []

        for (const item of results ?? []) {
            const mangaId = item.titleId.toString()
            const title = item.name
            const author = item.author
            const image = item.portraitImageUrl

            if (!mangaId || !title || collectedIds.includes(mangaId)) continue

            titles.push({
                mangaId: mangaId,
                title: title,
                subtitle: author,
                imageUrl: image
            })
        }

        return {
            items: titles
        }
    }

    async getPopularTitles(section: DiscoverSection, metadata: any | undefined) : Promise<PagedResults<SearchResultItem>> {
        const request = {
            url: `${API_URL}/title_list/ranking?format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = JSON.parse(Application.arrayBufferToUTF8String(response)) as MangaPlusResponse

        if (result.success === undefined) {
            throw new Error(langPopup(result.error, Language.ENGLISH)?.body ?? 'Unknown error')
        }

        const languages = await getLanguages()

        const results = result.success?.titleRankingView?.titles
            .filter((title) => languages.includes(title.language ?? Language.ENGLISH))

        const titles: SearchResultItem[] = []
        const collectedIds: string[] = []

        for (const item of results ?? []) {
            const mangaId = item.titleId.toString()
            const title = item.name
            const author = item.author
            const image = item.portraitImageUrl

            if (!mangaId || !title || collectedIds.includes(mangaId)) continue

            titles.push({
                mangaId: mangaId,
                title: title,
                subtitle: author,
                imageUrl: image
            })
        }

        return {
            items: titles
        }
    }

    async getLatestUpdates(section: DiscoverSection, metadata: any | undefined) : Promise<PagedResults<SearchResultItem>> {
        const request = {
            url: `${API_URL}/web/web_homeV4?lang=eng&format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = JSON.parse(Application.arrayBufferToUTF8String(response)) as MangaPlusResponse

        if (result.success === undefined) {
            throw new Error(langPopup(result.error, langCode)?.body ?? 'Unknown error')
        }

        const languages = await getLanguages()

        const results = result.success.webHomeViewV4?.groups
            .flatMap(ex => ex.titleGroups)
            .flatMap(ex => ex.titles)
            .map(title => title.title)
            .filter(title => languages.includes(title.language ?? Language.ENGLISH))

        const titles: SearchResultItem[] = []
        const collectedIds: string[] = []

        for (const item of results ?? []) {
            const mangaId = item.titleId.toString()
            const title = item.name
            const author = item.author
            const image = item.portraitImageUrl

            if (!mangaId || !title || collectedIds.includes(mangaId)) continue

            titles.push({
                mangaId: mangaId,
                title: title,
                subtitle: author,
                imageUrl: image
            })
        }

        return {
            items: titles
        }
    }


    async getSearchResults(query: SearchQuery, metadata: any): Promise<PagedResults<SearchResultItem>> {
        const title = query.title ?? ''

        const request = {
            url: `${API_URL}/title_list/allV2?format=JSON&${title ? 'filter=' + encodeURI(title) + '&' : ''}format=json`,
            method: 'GET'
        }

        const response = (await Application.scheduleRequest(request))[1]
        const result = JSON.parse(Application.arrayBufferToUTF8String(response)) as MangaPlusResponse

        if (result.success === undefined) {
            throw new Error(langPopup(result.error, Language.ENGLISH)?.body ?? 'Unknown error')
        }

        const ltitle = query.title?.toLowerCase() ?? ''
        const languages = await getLanguages()

        const results = result.success?.allTitlesViewV2?.AllTitlesGroup.flatMap((group) => group.titles)
            .filter((title) => languages.includes(title.language ?? Language.ENGLISH))
            .filter((title) => title.author?.toLowerCase().includes(ltitle) || title.name.toLowerCase().includes(ltitle))

        const titles: SearchResultItem[] = []
        const collectedIds: string[] = []

        for (const item of results ?? []) {
            const mangaId = item.titleId.toString()
            const title = item.name
            const author = item.author
            const image = item.portraitImageUrl

            if (!mangaId || !title || collectedIds.includes(mangaId)) continue

            titles.push({
                mangaId: mangaId,
                title: title,
                subtitle: author,
                imageUrl: image
            })
        }

        return {
            items: titles
        }
    }

    // Utility
    private decodeXoRCipher(buffer: Uint8Array, encryptionKey: string) {
        console.log('Decoding with key:', encryptionKey)
        const key = encryptionKey.match(/../g)?.map((byte) => parseInt(byte, 16)) ?? []

        return buffer.map((byte, index) => byte ^ (key[index % key.length] ?? 0))
    }
    
    registerInterceptors() {
        this.globalRateLimiter.registerInterceptor()
        Application.registerInterceptor(
            'mangaPlusInterceptor',
            Application.Selector(this as MangaPlusSource, 'interceptRequest'),
            Application.Selector(this as MangaPlusSource, 'interceptResponse')
        )
    }

    async interceptRequest(request: Request): Promise<Request> {
        request.headers = {
            ...(request.headers ?? {}),
            
            'Referer': `${BASE_URL}/`,
            'user-agent': await Application.getDefaultUserAgent()
        }

        if (request.url.startsWith('imageMangaId=')) {
            const mangaId = request.url.replace('imageMangaId=', '')
            request.url = await this.getThumbnailUrl(mangaId)
        }

        return request
    }

    async interceptResponse(request: Request, response: Response, data: ArrayBuffer): Promise<ArrayBuffer> {
        console.log(`here 1 request >>>>${JSON.stringify(request)}<<<<<< response>>>>>${JSON.stringify(response)}<<<<`)
        if (!request.url.includes('encryptionKey') && response.headers['Content-Type'] !== 'image/jpeg') {
            return data
        }

        console.log('here 2')
        if (request.url.includes('title_thumbnail_portrait_list')) {
            return data
        }

        console.log('here 3')
        const encryptionKey = request.url.substring(request.url.lastIndexOf('#') + 1) ?? ''
        
        console.log('here 4')
        const test = this.decodeXoRCipher(new Uint8Array(data), encryptionKey)
        console.log('here 5')
        return test.buffer
    }

    async registerDiscoverSections(): Promise<void> {

        Application.registerDiscoverSection(
            {
                id: 'featured',
                title: 'Featured',
                type: DiscoverSectionType.simpleCarousel
            },
            Application.Selector(this as MangaPlusSource, 'getFeaturedTitles')
        )

        Application.registerDiscoverSection(
            {
                id: 'popular',
                title: 'Popular',
                type: DiscoverSectionType.simpleCarousel
            },
            Application.Selector(this as MangaPlusSource, 'getPopularTitles')
        )

        Application.registerDiscoverSection(
            {
                id: 'latest_updates',
                title: 'Latest Updates',
                type: DiscoverSectionType.simpleCarousel
            },
            Application.Selector(this as MangaPlusSource, 'getLatestUpdates')
        )

    }

    /* TODO ?
    async registerSearchFilters(): Promise<void> {
        const genres = await this.getSearchTags()
        Application.registerSearchFilter({
            id: '0',
            title: 'Genres',
            type: 'dropdown',
            options: genres.map(genre => ({ id: genre.id, value: genre.title })),
            value: 'ALL'
        })
    }*/

    async getSettingsForm(): Promise<Form> {
        return new MangaPlusSettingForm()
    }
    
}
