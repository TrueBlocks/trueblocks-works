export namespace backup {
	
	export class BackupInfo {
	    name: string;
	    path: string;
	    size: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new BackupInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.size = source["size"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

export namespace fileops {
	
	export class Config {
	    BaseFolderPath: string;
	    PDFPreviewPath: string;
	    SubmissionExportPath: string;
	    TemplateFolderPath: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.BaseFolderPath = source["BaseFolderPath"];
	        this.PDFPreviewPath = source["PDFPreviewPath"];
	        this.SubmissionExportPath = source["SubmissionExportPath"];
	        this.TemplateFolderPath = source["TemplateFolderPath"];
	    }
	}

}

export namespace main {
	
	export class CollectionSize {
	    name: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionSize(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.count = source["count"];
	    }
	}
	export class CollectionsStats {
	    total: number;
	    largest: CollectionSize[];
	    sparkline: number[];
	
	    static createFrom(source: any = {}) {
	        return new CollectionsStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.largest = this.convertValues(source["largest"], CollectionSize);
	        this.sparkline = source["sparkline"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PendingAlert {
	    submissionID: number;
	    workTitle: string;
	    orgName: string;
	    daysWaiting: number;
	
	    static createFrom(source: any = {}) {
	        return new PendingAlert(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.submissionID = source["submissionID"];
	        this.workTitle = source["workTitle"];
	        this.orgName = source["orgName"];
	        this.daysWaiting = source["daysWaiting"];
	    }
	}
	export class RecentItem {
	    entityType: string;
	    entityID: number;
	    name: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entityType = source["entityType"];
	        this.entityID = source["entityID"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class YearProgressStats {
	    year: number;
	    submissions: number;
	    acceptances: number;
	    successRate: number;
	
	    static createFrom(source: any = {}) {
	        return new YearProgressStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.year = source["year"];
	        this.submissions = source["submissions"];
	        this.acceptances = source["acceptances"];
	        this.successRate = source["successRate"];
	    }
	}
	export class SubmissionsStats {
	    total: number;
	    pending: number;
	    thisYear: number;
	    byResponse: Record<string, number>;
	    byMonth: Record<string, number>;
	    acceptRate: number;
	    sparkline: number[];
	
	    static createFrom(source: any = {}) {
	        return new SubmissionsStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.pending = source["pending"];
	        this.thisYear = source["thisYear"];
	        this.byResponse = source["byResponse"];
	        this.byMonth = source["byMonth"];
	        this.acceptRate = source["acceptRate"];
	        this.sparkline = source["sparkline"];
	    }
	}
	export class OrgSubmitCount {
	    name: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new OrgSubmitCount(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.count = source["count"];
	    }
	}
	export class OrganizationsStats {
	    total: number;
	    byStatus: Record<string, number>;
	    byType: Record<string, number>;
	    topSubmitted: OrgSubmitCount[];
	    sparkline: number[];
	
	    static createFrom(source: any = {}) {
	        return new OrganizationsStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.byStatus = source["byStatus"];
	        this.byType = source["byType"];
	        this.topSubmitted = this.convertValues(source["topSubmitted"], OrgSubmitCount);
	        this.sparkline = source["sparkline"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorksStats {
	    total: number;
	    byType: Record<string, number>;
	    byStatus: Record<string, number>;
	    byYear: Record<string, number>;
	    byQuality: Record<string, number>;
	    sparkline: number[];
	
	    static createFrom(source: any = {}) {
	        return new WorksStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.byType = source["byType"];
	        this.byStatus = source["byStatus"];
	        this.byYear = source["byYear"];
	        this.byQuality = source["byQuality"];
	        this.sparkline = source["sparkline"];
	    }
	}
	export class DashboardStats {
	    works: WorksStats;
	    organizations: OrganizationsStats;
	    submissions: SubmissionsStats;
	    collections: CollectionsStats;
	    yearProgress: YearProgressStats;
	    recentItems: RecentItem[];
	    pendingAlerts: PendingAlert[];
	
	    static createFrom(source: any = {}) {
	        return new DashboardStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.works = this.convertValues(source["works"], WorksStats);
	        this.organizations = this.convertValues(source["organizations"], OrganizationsStats);
	        this.submissions = this.convertValues(source["submissions"], SubmissionsStats);
	        this.collections = this.convertValues(source["collections"], CollectionsStats);
	        this.yearProgress = this.convertValues(source["yearProgress"], YearProgressStats);
	        this.recentItems = this.convertValues(source["recentItems"], RecentItem);
	        this.pendingAlerts = this.convertValues(source["pendingAlerts"], PendingAlert);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EnumLists {
	    statusList: string[];
	    qualityList: string[];
	    workTypeList: string[];
	
	    static createFrom(source: any = {}) {
	        return new EnumLists(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusList = source["statusList"];
	        this.qualityList = source["qualityList"];
	        this.workTypeList = source["workTypeList"];
	    }
	}
	export class ExportResult {
	    table: string;
	    count: number;
	    success: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.table = source["table"];
	        this.count = source["count"];
	        this.success = source["success"];
	        this.error = source["error"];
	    }
	}
	
	
	export class OrgsFilterOptions {
	    statuses: string[];
	    types: string[];
	    timings: string[];
	
	    static createFrom(source: any = {}) {
	        return new OrgsFilterOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statuses = source["statuses"];
	        this.types = source["types"];
	        this.timings = source["timings"];
	    }
	}
	export class PathCheckResult {
	    generatedPath: string;
	    storedPath: string;
	    status: string;
	    fileExists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PathCheckResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.generatedPath = source["generatedPath"];
	        this.storedPath = source["storedPath"];
	        this.status = source["status"];
	        this.fileExists = source["fileExists"];
	    }
	}
	
	
	export class ReportIssue {
	    id: number;
	    description: string;
	    entityType: string;
	    entityID: number;
	    entityName: string;
	
	    static createFrom(source: any = {}) {
	        return new ReportIssue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.description = source["description"];
	        this.entityType = source["entityType"];
	        this.entityID = source["entityID"];
	        this.entityName = source["entityName"];
	    }
	}
	export class ReportCategory {
	    name: string;
	    icon: string;
	    issues: ReportIssue[];
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.issues = this.convertValues(source["issues"], ReportIssue);
	        this.count = source["count"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ReportsResult {
	    categories: ReportCategory[];
	    totalCount: number;
	
	    static createFrom(source: any = {}) {
	        return new ReportsResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.categories = this.convertValues(source["categories"], ReportCategory);
	        this.totalCount = source["totalCount"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SubmissionsFilterOptions {
	    types: string[];
	    responses: string[];
	    statuses: string[];
	
	    static createFrom(source: any = {}) {
	        return new SubmissionsFilterOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.types = source["types"];
	        this.responses = source["responses"];
	        this.statuses = source["statuses"];
	    }
	}
	
	export class TableInfo {
	    name: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new TableInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.count = source["count"];
	    }
	}
	export class WorkUpdateResult {
	    work?: models.Work;
	    fileMoved: boolean;
	    oldPath?: string;
	    newPath?: string;
	    moveError?: string;
	    collUpdated: boolean;
	
	    static createFrom(source: any = {}) {
	        return new WorkUpdateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.work = this.convertValues(source["work"], models.Work);
	        this.fileMoved = source["fileMoved"];
	        this.oldPath = source["oldPath"];
	        this.newPath = source["newPath"];
	        this.moveError = source["moveError"];
	        this.collUpdated = source["collUpdated"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class WorksFilterOptions {
	    years: string[];
	    types: string[];
	    statuses: string[];
	    qualities: string[];
	
	    static createFrom(source: any = {}) {
	        return new WorksFilterOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.years = source["years"];
	        this.types = source["types"];
	        this.statuses = source["statuses"];
	        this.qualities = source["qualities"];
	    }
	}
	

}

export namespace models {
	
	export class Collection {
	    collID: number;
	    collectionName: string;
	    type?: string;
	    attributes: string;
	    createdAt: string;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Collection(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collID = source["collID"];
	        this.collectionName = source["collectionName"];
	        this.type = source["type"];
	        this.attributes = source["attributes"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
	export class CollectionDetail {
	    id: number;
	    collID: number;
	    workID: number;
	    position: number;
	    collectionName?: string;
	
	    static createFrom(source: any = {}) {
	        return new CollectionDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.collID = source["collID"];
	        this.workID = source["workID"];
	        this.position = source["position"];
	        this.collectionName = source["collectionName"];
	    }
	}
	export class CollectionView {
	    collID: number;
	    collectionName: string;
	    type?: string;
	    attributes: string;
	    createdAt: string;
	    modifiedAt: string;
	    nItems: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collID = source["collID"];
	        this.collectionName = source["collectionName"];
	        this.type = source["type"];
	        this.attributes = source["attributes"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.nItems = source["nItems"];
	    }
	}
	export class CollectionWork {
	    workID: number;
	    title: string;
	    type: string;
	    year?: string;
	    status: string;
	    quality: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    createdAt: string;
	    modifiedAt: string;
	    position: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionWork(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workID = source["workID"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.status = source["status"];
	        this.quality = source["quality"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.position = source["position"];
	    }
	}
	export class Note {
	    id: number;
	    entityType: string;
	    entityID: number;
	    type?: string;
	    note?: string;
	    attributes: string;
	    modifiedAt?: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Note(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.entityType = source["entityType"];
	        this.entityID = source["entityID"];
	        this.type = source["type"];
	        this.note = source["note"];
	        this.attributes = source["attributes"];
	        this.modifiedAt = source["modifiedAt"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class Organization {
	    orgID: number;
	    name: string;
	    otherName?: string;
	    url?: string;
	    otherURL?: string;
	    status: string;
	    type: string;
	    timing?: string;
	    submissionTypes?: string;
	    accepts?: string;
	    myInterest?: string;
	    ranking?: number;
	    source?: string;
	    websiteMenu?: string;
	    duotropeNum?: number;
	    nPushFiction: number;
	    nPushNonfiction: number;
	    nPushPoetry: number;
	    contestEnds?: string;
	    contestFee?: string;
	    contestPrize?: string;
	    contestPrize2?: string;
	    attributes: string;
	    dateAdded?: string;
	    modifiedAt?: string;
	
	    static createFrom(source: any = {}) {
	        return new Organization(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.orgID = source["orgID"];
	        this.name = source["name"];
	        this.otherName = source["otherName"];
	        this.url = source["url"];
	        this.otherURL = source["otherURL"];
	        this.status = source["status"];
	        this.type = source["type"];
	        this.timing = source["timing"];
	        this.submissionTypes = source["submissionTypes"];
	        this.accepts = source["accepts"];
	        this.myInterest = source["myInterest"];
	        this.ranking = source["ranking"];
	        this.source = source["source"];
	        this.websiteMenu = source["websiteMenu"];
	        this.duotropeNum = source["duotropeNum"];
	        this.nPushFiction = source["nPushFiction"];
	        this.nPushNonfiction = source["nPushNonfiction"];
	        this.nPushPoetry = source["nPushPoetry"];
	        this.contestEnds = source["contestEnds"];
	        this.contestFee = source["contestFee"];
	        this.contestPrize = source["contestPrize"];
	        this.contestPrize2 = source["contestPrize2"];
	        this.attributes = source["attributes"];
	        this.dateAdded = source["dateAdded"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
	export class OrganizationWithNotes {
	    orgID: number;
	    name: string;
	    otherName?: string;
	    url?: string;
	    otherURL?: string;
	    status: string;
	    type: string;
	    timing?: string;
	    submissionTypes?: string;
	    accepts?: string;
	    myInterest?: string;
	    ranking?: number;
	    source?: string;
	    websiteMenu?: string;
	    duotropeNum?: number;
	    nPushFiction: number;
	    nPushNonfiction: number;
	    nPushPoetry: number;
	    contestEnds?: string;
	    contestFee?: string;
	    contestPrize?: string;
	    contestPrize2?: string;
	    attributes: string;
	    dateAdded?: string;
	    modifiedAt?: string;
	    nSubmissions: number;
	    notes?: string;
	
	    static createFrom(source: any = {}) {
	        return new OrganizationWithNotes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.orgID = source["orgID"];
	        this.name = source["name"];
	        this.otherName = source["otherName"];
	        this.url = source["url"];
	        this.otherURL = source["otherURL"];
	        this.status = source["status"];
	        this.type = source["type"];
	        this.timing = source["timing"];
	        this.submissionTypes = source["submissionTypes"];
	        this.accepts = source["accepts"];
	        this.myInterest = source["myInterest"];
	        this.ranking = source["ranking"];
	        this.source = source["source"];
	        this.websiteMenu = source["websiteMenu"];
	        this.duotropeNum = source["duotropeNum"];
	        this.nPushFiction = source["nPushFiction"];
	        this.nPushNonfiction = source["nPushNonfiction"];
	        this.nPushPoetry = source["nPushPoetry"];
	        this.contestEnds = source["contestEnds"];
	        this.contestFee = source["contestFee"];
	        this.contestPrize = source["contestPrize"];
	        this.contestPrize2 = source["contestPrize2"];
	        this.attributes = source["attributes"];
	        this.dateAdded = source["dateAdded"];
	        this.modifiedAt = source["modifiedAt"];
	        this.nSubmissions = source["nSubmissions"];
	        this.notes = source["notes"];
	    }
	}
	export class ParsedQuery {
	    terms: string[];
	    phrases: string[];
	    exclusions: string[];
	    entityFilter: string[];
	    rawQuery: string;
	
	    static createFrom(source: any = {}) {
	        return new ParsedQuery(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.terms = source["terms"];
	        this.phrases = source["phrases"];
	        this.exclusions = source["exclusions"];
	        this.entityFilter = source["entityFilter"];
	        this.rawQuery = source["rawQuery"];
	    }
	}
	export class RecentChange {
	    entityType: string;
	    entityID: number;
	    name: string;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new RecentChange(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entityType = source["entityType"];
	        this.entityID = source["entityID"];
	        this.name = source["name"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
	export class SearchResult {
	    entityType: string;
	    entityID: number;
	    title: string;
	    subtitle?: string;
	    snippet?: string;
	    rank: number;
	    parentEntityType?: string;
	    parentEntityID?: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entityType = source["entityType"];
	        this.entityID = source["entityID"];
	        this.title = source["title"];
	        this.subtitle = source["subtitle"];
	        this.snippet = source["snippet"];
	        this.rank = source["rank"];
	        this.parentEntityType = source["parentEntityType"];
	        this.parentEntityID = source["parentEntityID"];
	    }
	}
	export class SearchResponse {
	    results: SearchResult[];
	    parsedQuery: ParsedQuery;
	
	    static createFrom(source: any = {}) {
	        return new SearchResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.results = this.convertValues(source["results"], SearchResult);
	        this.parsedQuery = this.convertValues(source["parsedQuery"], ParsedQuery);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class Submission {
	    submissionID: number;
	    workID: number;
	    orgID: number;
	    draft: string;
	    submissionDate?: string;
	    submissionType?: string;
	    queryDate?: string;
	    responseDate?: string;
	    responseType?: string;
	    contestName?: string;
	    cost?: number;
	    userID?: string;
	    password?: string;
	    webAddress?: string;
	    attributes: string;
	    createdAt: string;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Submission(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.submissionID = source["submissionID"];
	        this.workID = source["workID"];
	        this.orgID = source["orgID"];
	        this.draft = source["draft"];
	        this.submissionDate = source["submissionDate"];
	        this.submissionType = source["submissionType"];
	        this.queryDate = source["queryDate"];
	        this.responseDate = source["responseDate"];
	        this.responseType = source["responseType"];
	        this.contestName = source["contestName"];
	        this.cost = source["cost"];
	        this.userID = source["userID"];
	        this.password = source["password"];
	        this.webAddress = source["webAddress"];
	        this.attributes = source["attributes"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
	export class SubmissionView {
	    submissionID: number;
	    workID: number;
	    orgID: number;
	    draft: string;
	    submissionDate?: string;
	    submissionType?: string;
	    queryDate?: string;
	    responseDate?: string;
	    responseType?: string;
	    contestName?: string;
	    cost?: number;
	    userID?: string;
	    password?: string;
	    webAddress?: string;
	    attributes: string;
	    createdAt: string;
	    modifiedAt: string;
	    titleOfWork: string;
	    journalName: string;
	    journalStatus: string;
	    decisionPending: string;
	
	    static createFrom(source: any = {}) {
	        return new SubmissionView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.submissionID = source["submissionID"];
	        this.workID = source["workID"];
	        this.orgID = source["orgID"];
	        this.draft = source["draft"];
	        this.submissionDate = source["submissionDate"];
	        this.submissionType = source["submissionType"];
	        this.queryDate = source["queryDate"];
	        this.responseDate = source["responseDate"];
	        this.responseType = source["responseType"];
	        this.contestName = source["contestName"];
	        this.cost = source["cost"];
	        this.userID = source["userID"];
	        this.password = source["password"];
	        this.webAddress = source["webAddress"];
	        this.attributes = source["attributes"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.titleOfWork = source["titleOfWork"];
	        this.journalName = source["journalName"];
	        this.journalStatus = source["journalStatus"];
	        this.decisionPending = source["decisionPending"];
	    }
	}
	export class Work {
	    workID: number;
	    title: string;
	    type: string;
	    year?: string;
	    status: string;
	    quality: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    createdAt: string;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Work(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workID = source["workID"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.status = source["status"];
	        this.quality = source["quality"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
	export class WorkView {
	    workID: number;
	    title: string;
	    type: string;
	    year?: string;
	    status: string;
	    quality: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    createdAt: string;
	    modifiedAt: string;
	    isDeleted: boolean;
	    ageDays?: number;
	    nSubmissions: number;
	    collectionList?: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkView(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workID = source["workID"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.status = source["status"];
	        this.quality = source["quality"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.isDeleted = source["isDeleted"];
	        this.ageDays = source["ageDays"];
	        this.nSubmissions = source["nSubmissions"];
	        this.collectionList = source["collectionList"];
	    }
	}

}

export namespace settings {
	
	export class Settings {
	    baseFolderPath: string;
	    pdfPreviewPath: string;
	    submissionExportPath: string;
	    templateFolderPath: string;
	    libreOfficePath?: string;
	    exportFolderPath?: string;
	    setupCompleted: boolean;
	    theme: string;
	    darkMode: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseFolderPath = source["baseFolderPath"];
	        this.pdfPreviewPath = source["pdfPreviewPath"];
	        this.submissionExportPath = source["submissionExportPath"];
	        this.templateFolderPath = source["templateFolderPath"];
	        this.libreOfficePath = source["libreOfficePath"];
	        this.exportFolderPath = source["exportFolderPath"];
	        this.setupCompleted = source["setupCompleted"];
	        this.theme = source["theme"];
	        this.darkMode = source["darkMode"];
	    }
	}

}

export namespace state {
	
	export class RangeFilter {
	    min?: number;
	    max?: number;
	
	    static createFrom(source: any = {}) {
	        return new RangeFilter(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.min = source["min"];
	        this.max = source["max"];
	    }
	}
	export class TableState {
	    search?: string;
	    sort: ViewSort;
	    page?: number;
	    pageSize?: number;
	    filters?: Record<string, Array<string>>;
	    rangeFilters?: Record<string, RangeFilter>;
	
	    static createFrom(source: any = {}) {
	        return new TableState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.search = source["search"];
	        this.sort = this.convertValues(source["sort"], ViewSort);
	        this.page = source["page"];
	        this.pageSize = source["pageSize"];
	        this.filters = source["filters"];
	        this.rangeFilters = this.convertValues(source["rangeFilters"], RangeFilter, true);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SortColumn {
	    column: string;
	    direction: string;
	
	    static createFrom(source: any = {}) {
	        return new SortColumn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.column = source["column"];
	        this.direction = source["direction"];
	    }
	}
	export class ViewSort {
	    primary: SortColumn;
	    secondary: SortColumn;
	
	    static createFrom(source: any = {}) {
	        return new ViewSort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.primary = this.convertValues(source["primary"], SortColumn);
	        this.secondary = this.convertValues(source["secondary"], SortColumn);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class AppState {
	    lastWorkID?: number;
	    lastOrgID?: number;
	    lastCollectionID?: number;
	    lastSubmissionID?: number;
	    worksFilter?: string;
	    worksYearFilter: string[];
	    worksTypeFilter: string[];
	    worksStatusFilter: string[];
	    worksQualityFilter: string[];
	    orgsFilter?: string;
	    orgsStatusFilter: string[];
	    orgsTypeFilter: string[];
	    orgsTimingFilter: string[];
	    orgsSubmissionsMin?: number;
	    orgsSubmissionsMax?: number;
	    orgsPushcartsMin?: number;
	    orgsPushcartsMax?: number;
	    submissionsFilter?: string;
	    submissionsTypeFilter: string[];
	    submissionsResponseFilter: string[];
	    submissionsStatusFilter: string[];
	    collectionsFilter?: string;
	    lastRoute?: string;
	    sidebarCollapsed: boolean;
	    previewPanelWidth?: number;
	    windowX?: number;
	    windowY?: number;
	    windowWidth?: number;
	    windowHeight?: number;
	    viewSorts?: Record<string, ViewSort>;
	    searchHistory?: string[];
	    lastCollectionType?: string;
	    tables?: Record<string, TableState>;
	    tabs?: Record<string, string>;
	    showDeleted: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.lastWorkID = source["lastWorkID"];
	        this.lastOrgID = source["lastOrgID"];
	        this.lastCollectionID = source["lastCollectionID"];
	        this.lastSubmissionID = source["lastSubmissionID"];
	        this.worksFilter = source["worksFilter"];
	        this.worksYearFilter = source["worksYearFilter"];
	        this.worksTypeFilter = source["worksTypeFilter"];
	        this.worksStatusFilter = source["worksStatusFilter"];
	        this.worksQualityFilter = source["worksQualityFilter"];
	        this.orgsFilter = source["orgsFilter"];
	        this.orgsStatusFilter = source["orgsStatusFilter"];
	        this.orgsTypeFilter = source["orgsTypeFilter"];
	        this.orgsTimingFilter = source["orgsTimingFilter"];
	        this.orgsSubmissionsMin = source["orgsSubmissionsMin"];
	        this.orgsSubmissionsMax = source["orgsSubmissionsMax"];
	        this.orgsPushcartsMin = source["orgsPushcartsMin"];
	        this.orgsPushcartsMax = source["orgsPushcartsMax"];
	        this.submissionsFilter = source["submissionsFilter"];
	        this.submissionsTypeFilter = source["submissionsTypeFilter"];
	        this.submissionsResponseFilter = source["submissionsResponseFilter"];
	        this.submissionsStatusFilter = source["submissionsStatusFilter"];
	        this.collectionsFilter = source["collectionsFilter"];
	        this.lastRoute = source["lastRoute"];
	        this.sidebarCollapsed = source["sidebarCollapsed"];
	        this.previewPanelWidth = source["previewPanelWidth"];
	        this.windowX = source["windowX"];
	        this.windowY = source["windowY"];
	        this.windowWidth = source["windowWidth"];
	        this.windowHeight = source["windowHeight"];
	        this.viewSorts = this.convertValues(source["viewSorts"], ViewSort, true);
	        this.searchHistory = source["searchHistory"];
	        this.lastCollectionType = source["lastCollectionType"];
	        this.tables = this.convertValues(source["tables"], TableState, true);
	        this.tabs = source["tabs"];
	        this.showDeleted = source["showDeleted"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	

}

