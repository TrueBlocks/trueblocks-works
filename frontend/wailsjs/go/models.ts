export namespace app {
	
	export class ApplyTemplateResult {
	    success: number;
	    failed: number;
	
	    static createFrom(source: any = {}) {
	        return new ApplyTemplateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.failed = source["failed"];
	    }
	}
	export class BookExportResult {
	    success: boolean;
	    outputPath?: string;
	    error?: string;
	    warnings?: string[];
	    workCount: number;
	    duration: string;
	
	    static createFrom(source: any = {}) {
	        return new BookExportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.outputPath = source["outputPath"];
	        this.error = source["error"];
	        this.warnings = source["warnings"];
	        this.workCount = source["workCount"];
	        this.duration = source["duration"];
	    }
	}
	export class StyleAuditResult {
	    workID: number;
	    title: string;
	    templateStylesUsed: string[];
	    unknownStyles: string[];
	    directFormattingCount: number;
	    directFormattingTypes: string[];
	    isClean: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new StyleAuditResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workID = source["workID"];
	        this.title = source["title"];
	        this.templateStylesUsed = source["templateStylesUsed"];
	        this.unknownStyles = source["unknownStyles"];
	        this.directFormattingCount = source["directFormattingCount"];
	        this.directFormattingTypes = source["directFormattingTypes"];
	        this.isClean = source["isClean"];
	        this.error = source["error"];
	    }
	}
	export class CollectionAuditSummary {
	    totalWorks: number;
	    cleanWorks: number;
	    dirtyWorks: number;
	    missingFiles: number;
	    results: StyleAuditResult[];
	
	    static createFrom(source: any = {}) {
	        return new CollectionAuditSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalWorks = source["totalWorks"];
	        this.cleanWorks = source["cleanWorks"];
	        this.dirtyWorks = source["dirtyWorks"];
	        this.missingFiles = source["missingFiles"];
	        this.results = this.convertValues(source["results"], StyleAuditResult);
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
	export class CollectionSize {
	    collID: number;
	    name: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new CollectionSize(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.collID = source["collID"];
	        this.name = source["name"];
	        this.count = source["count"];
	    }
	}
	export class CollectionsStats {
	    total: number;
	    largest: CollectionSize[];
	    byTypeBook: CollectionSize[];
	    byTypeOther: CollectionSize[];
	    sparkline: number[];
	
	    static createFrom(source: any = {}) {
	        return new CollectionsStats(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.total = source["total"];
	        this.largest = this.convertValues(source["largest"], CollectionSize);
	        this.byTypeBook = this.convertValues(source["byTypeBook"], CollectionSize);
	        this.byTypeOther = this.convertValues(source["byTypeOther"], CollectionSize);
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
	    byYearWorks: Record<string, number>;
	    byYearIdeas: Record<string, number>;
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
	        this.byYearWorks = source["byYearWorks"];
	        this.byYearIdeas = source["byYearIdeas"];
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
	    yearList: string[];
	
	    static createFrom(source: any = {}) {
	        return new EnumLists(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.statusList = source["statusList"];
	        this.qualityList = source["qualityList"];
	        this.workTypeList = source["workTypeList"];
	        this.yearList = source["yearList"];
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
	export class FileEdit {
	    filename: string;
	    title: string;
	    type: string;
	    year: string;
	    quality: string;
	
	    static createFrom(source: any = {}) {
	        return new FileEdit(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.quality = source["quality"];
	    }
	}
	export class FileModTimes {
	    docxPath: string;
	    docxModTime: string;
	    pdfPath: string;
	    pdfModTime: string;
	    docxIsNewer: boolean;
	    docxExists: boolean;
	    pdfExists: boolean;
	
	    static createFrom(source: any = {}) {
	        return new FileModTimes(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.docxPath = source["docxPath"];
	        this.docxModTime = source["docxModTime"];
	        this.pdfPath = source["pdfPath"];
	        this.pdfModTime = source["pdfModTime"];
	        this.docxIsNewer = source["docxIsNewer"];
	        this.docxExists = source["docxExists"];
	        this.pdfExists = source["pdfExists"];
	    }
	}
	export class FilePreview {
	    filename: string;
	    title?: string;
	    type?: string;
	    year?: string;
	    quality?: string;
	    valid: boolean;
	    errors?: string[];
	
	    static createFrom(source: any = {}) {
	        return new FilePreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.quality = source["quality"];
	        this.valid = source["valid"];
	        this.errors = source["errors"];
	    }
	}
	export class ImportConflict {
	    type: string;
	    existingWork?: models.Work;
	
	    static createFrom(source: any = {}) {
	        return new ImportConflict(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.existingWork = this.convertValues(source["existingWork"], models.Work);
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
	export class ImportPreview {
	    files: FilePreview[];
	    totalCount: number;
	    validCount: number;
	    byExtension: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new ImportPreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.files = this.convertValues(source["files"], FilePreview);
	        this.totalCount = source["totalCount"];
	        this.validCount = source["validCount"];
	        this.byExtension = source["byExtension"];
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
	export class InvalidFile {
	    filename: string;
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new InvalidFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.filename = source["filename"];
	        this.errors = source["errors"];
	    }
	}
	export class ImportResult {
	    status: string;
	    imported: number;
	    updated: number;
	    invalid: InvalidFile[];
	    collectionID: number;
	    collectionName?: string;
	    unknownType?: string;
	    unknownExtension?: string;
	    currentFile?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.status = source["status"];
	        this.imported = source["imported"];
	        this.updated = source["updated"];
	        this.invalid = this.convertValues(source["invalid"], InvalidFile);
	        this.collectionID = source["collectionID"];
	        this.collectionName = source["collectionName"];
	        this.unknownType = source["unknownType"];
	        this.unknownExtension = source["unknownExtension"];
	        this.currentFile = source["currentFile"];
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
	export class PartInfo {
	    index: number;
	    title: string;
	    workCount: number;
	    pageCount: number;
	    isCached: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PartInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.title = source["title"];
	        this.workCount = source["workCount"];
	        this.pageCount = source["pageCount"];
	        this.isCached = source["isCached"];
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
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ReportCategory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.icon = source["icon"];
	        this.issues = this.convertValues(source["issues"], ReportIssue);
	        this.count = source["count"];
	        this.error = source["error"];
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
	export class TemplateStyle {
	    styleId: string;
	    name: string;
	    type: string;
	    isCustom: boolean;
	    isBuiltIn: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TemplateStyle(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.styleId = source["styleId"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.isCustom = source["isCustom"];
	        this.isBuiltIn = source["isBuiltIn"];
	    }
	}
	export class TemplateValidation {
	    isValid: boolean;
	    path: string;
	    styles: TemplateStyle[];
	    requiredFound: string[];
	    requiredMissing: string[];
	    errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new TemplateValidation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isValid = source["isValid"];
	        this.path = source["path"];
	        this.styles = this.convertValues(source["styles"], TemplateStyle);
	        this.requiredFound = source["requiredFound"];
	        this.requiredMissing = source["requiredMissing"];
	        this.errors = source["errors"];
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
	export class WorkBookAuditStatus {
	    isInBook: boolean;
	    unknownStyles: number;
	    unknownStyleNames: string[];
	    directFormatting: number;
	    directFormattingTypes: string[];
	    isClean: boolean;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkBookAuditStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.isInBook = source["isInBook"];
	        this.unknownStyles = source["unknownStyles"];
	        this.unknownStyleNames = source["unknownStyleNames"];
	        this.directFormatting = source["directFormatting"];
	        this.directFormattingTypes = source["directFormattingTypes"];
	        this.isClean = source["isClean"];
	        this.error = source["error"];
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

export namespace db {
	
	export class DeleteConfirmation {
	    entityType: string;
	    entityName: string;
	    noteCount: number;
	    submissionCount: number;
	    collectionCount: number;
	    hasFile: boolean;
	    filePath: string;
	
	    static createFrom(source: any = {}) {
	        return new DeleteConfirmation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.entityType = source["entityType"];
	        this.entityName = source["entityName"];
	        this.noteCount = source["noteCount"];
	        this.submissionCount = source["submissionCount"];
	        this.collectionCount = source["collectionCount"];
	        this.hasFile = source["hasFile"];
	        this.filePath = source["filePath"];
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
	export class ParsedFilename {
	    QualityMark: string;
	    Quality: string;
	    Type: string;
	    Year: string;
	    Title: string;
	    Extension: string;
	    Valid: boolean;
	    Errors: string[];
	
	    static createFrom(source: any = {}) {
	        return new ParsedFilename(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.QualityMark = source["QualityMark"];
	        this.Quality = source["Quality"];
	        this.Type = source["Type"];
	        this.Year = source["Year"];
	        this.Title = source["Title"];
	        this.Extension = source["Extension"];
	        this.Valid = source["Valid"];
	        this.Errors = source["Errors"];
	    }
	}
	export class SupportingInfo {
	    exists: boolean;
	    path: string;
	    isFolder: boolean;
	    size: number;
	    modTime: string;
	    count: number;
	
	    static createFrom(source: any = {}) {
	        return new SupportingInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.exists = source["exists"];
	        this.path = source["path"];
	        this.isFolder = source["isFolder"];
	        this.size = source["size"];
	        this.modTime = source["modTime"];
	        this.count = source["count"];
	    }
	}

}

export namespace fts {
	
	export class FailedWork {
	    workID: number;
	    title: string;
	    path: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new FailedWork(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workID = source["workID"];
	        this.title = source["title"];
	        this.path = source["path"];
	        this.error = source["error"];
	    }
	}
	export class BuildReport {
	    success: boolean;
	    documentCount: number;
	    wordCount: number;
	    duration: number;
	    errors: string[];
	    failedWorks: FailedWork[];
	
	    static createFrom(source: any = {}) {
	        return new BuildReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.success = source["success"];
	        this.documentCount = source["documentCount"];
	        this.wordCount = source["wordCount"];
	        this.duration = source["duration"];
	        this.errors = source["errors"];
	        this.failedWorks = this.convertValues(source["failedWorks"], FailedWork);
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
	export class ExtractionResult {
	    WorkID: number;
	    TextContent: string;
	    WordCount: number;
	    // Go type: time
	    ExtractedAt: any;
	    SourceMtime: number;
	    SourceSize: number;
	    Error: any;
	
	    static createFrom(source: any = {}) {
	        return new ExtractionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.WorkID = source["WorkID"];
	        this.TextContent = source["TextContent"];
	        this.WordCount = source["WordCount"];
	        this.ExtractedAt = this.convertValues(source["ExtractedAt"], null);
	        this.SourceMtime = source["SourceMtime"];
	        this.SourceSize = source["SourceSize"];
	        this.Error = source["Error"];
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
	
	export class Filters {
	    types?: string[];
	    years?: string[];
	    statuses?: string[];
	    workIds?: number[];
	
	    static createFrom(source: any = {}) {
	        return new Filters(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.types = source["types"];
	        this.years = source["years"];
	        this.statuses = source["statuses"];
	        this.workIds = source["workIds"];
	    }
	}
	export class Query {
	    text: string;
	    filters: Filters;
	    limit: number;
	    offset: number;
	    includeContent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Query(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.text = source["text"];
	        this.filters = this.convertValues(source["filters"], Filters);
	        this.limit = source["limit"];
	        this.offset = source["offset"];
	        this.includeContent = source["includeContent"];
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
	export class Result {
	    workId: number;
	    title: string;
	    type: string;
	    year: string;
	    status: string;
	    snippet: string;
	    rank: number;
	    textContent?: string;
	    wordCount: number;
	
	    static createFrom(source: any = {}) {
	        return new Result(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workId = source["workId"];
	        this.title = source["title"];
	        this.type = source["type"];
	        this.year = source["year"];
	        this.status = source["status"];
	        this.snippet = source["snippet"];
	        this.rank = source["rank"];
	        this.textContent = source["textContent"];
	        this.wordCount = source["wordCount"];
	    }
	}
	export class SearchResponse {
	    query: Query;
	    results: Result[];
	    totalCount: number;
	    queryTime: number;
	
	    static createFrom(source: any = {}) {
	        return new SearchResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = this.convertValues(source["query"], Query);
	        this.results = this.convertValues(source["results"], Result);
	        this.totalCount = source["totalCount"];
	        this.queryTime = source["queryTime"];
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
	export class StalenessReport {
	    TotalWorks: number;
	    IndexedWorks: number;
	    StaleWorks: number;
	    MissingWorks: number;
	    OrphanedWorks: number;
	    StaleWorkIDs: number[];
	    MissingWorkIDs: number[];
	
	    static createFrom(source: any = {}) {
	        return new StalenessReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.TotalWorks = source["TotalWorks"];
	        this.IndexedWorks = source["IndexedWorks"];
	        this.StaleWorks = source["StaleWorks"];
	        this.MissingWorks = source["MissingWorks"];
	        this.OrphanedWorks = source["OrphanedWorks"];
	        this.StaleWorkIDs = source["StaleWorkIDs"];
	        this.MissingWorkIDs = source["MissingWorkIDs"];
	    }
	}
	export class Status {
	    available: boolean;
	    documentCount: number;
	    staleCount: number;
	    missingCount: number;
	    indexSize: number;
	    // Go type: time
	    lastUpdated: any;
	    totalWords: number;
	
	    static createFrom(source: any = {}) {
	        return new Status(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.available = source["available"];
	        this.documentCount = source["documentCount"];
	        this.staleCount = source["staleCount"];
	        this.missingCount = source["missingCount"];
	        this.indexSize = source["indexSize"];
	        this.lastUpdated = this.convertValues(source["lastUpdated"], null);
	        this.totalWords = source["totalWords"];
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

export namespace models {
	
	export class Book {
	    bookID: number;
	    collID: number;
	    title: string;
	    subtitle?: string;
	    author: string;
	    copyright?: string;
	    dedication?: string;
	    acknowledgements?: string;
	    aboutAuthor?: string;
	    coverPath?: string;
	    isbn?: string;
	    publishedDate?: string;
	    templatePath?: string;
	    exportPath?: string;
	    status: string;
	    headerFont?: string;
	    headerSize?: number;
	    pageNumFont?: string;
	    pageNumSize?: number;
	    selectedParts?: string;
	    createdAt: string;
	    modifiedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Book(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.bookID = source["bookID"];
	        this.collID = source["collID"];
	        this.title = source["title"];
	        this.subtitle = source["subtitle"];
	        this.author = source["author"];
	        this.copyright = source["copyright"];
	        this.dedication = source["dedication"];
	        this.acknowledgements = source["acknowledgements"];
	        this.aboutAuthor = source["aboutAuthor"];
	        this.coverPath = source["coverPath"];
	        this.isbn = source["isbn"];
	        this.publishedDate = source["publishedDate"];
	        this.templatePath = source["templatePath"];
	        this.exportPath = source["exportPath"];
	        this.status = source["status"];
	        this.headerFont = source["headerFont"];
	        this.headerSize = source["headerSize"];
	        this.pageNumFont = source["pageNumFont"];
	        this.pageNumSize = source["pageNumSize"];
	        this.selectedParts = source["selectedParts"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	    }
	}
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
	    isDeleted: boolean;
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
	        this.isDeleted = source["isDeleted"];
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
	    qualityAtPublish?: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    fileMtime?: number;
	    createdAt: string;
	    modifiedAt: string;
	    position: number;
	    isTemplateClean: boolean;
	
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
	        this.qualityAtPublish = source["qualityAtPublish"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.fileMtime = source["fileMtime"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.position = source["position"];
	        this.isTemplateClean = source["isTemplateClean"];
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
	    nAccepted: number;
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
	        this.nAccepted = source["nAccepted"];
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
	    isDeleted: boolean;
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
	        this.isDeleted = source["isDeleted"];
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
	    qualityAtPublish?: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    fileMtime?: number;
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
	        this.qualityAtPublish = source["qualityAtPublish"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.fileMtime = source["fileMtime"];
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
	    qualityAtPublish?: string;
	    docType: string;
	    path?: string;
	    draft?: string;
	    nWords?: number;
	    courseName?: string;
	    attributes: string;
	    accessDate?: string;
	    fileMtime?: number;
	    createdAt: string;
	    modifiedAt: string;
	    isDeleted: boolean;
	    ageDays?: number;
	    nSubmissions: number;
	    nNotes: number;
	    collectionList?: string;
	    generatedPath: string;
	    needsMove: boolean;
	
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
	        this.qualityAtPublish = source["qualityAtPublish"];
	        this.docType = source["docType"];
	        this.path = source["path"];
	        this.draft = source["draft"];
	        this.nWords = source["nWords"];
	        this.courseName = source["courseName"];
	        this.attributes = source["attributes"];
	        this.accessDate = source["accessDate"];
	        this.fileMtime = source["fileMtime"];
	        this.createdAt = source["createdAt"];
	        this.modifiedAt = source["modifiedAt"];
	        this.isDeleted = source["isDeleted"];
	        this.ageDays = source["ageDays"];
	        this.nSubmissions = source["nSubmissions"];
	        this.nNotes = source["nNotes"];
	        this.collectionList = source["collectionList"];
	        this.generatedPath = source["generatedPath"];
	        this.needsMove = source["needsMove"];
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
	    collectionExportPath?: string;
	    setupCompleted: boolean;
	    theme: string;
	    darkMode: boolean;
	    archiveOnDelete: boolean;
	    validExtensions?: string[];
	
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
	        this.collectionExportPath = source["collectionExportPath"];
	        this.setupCompleted = source["setupCompleted"];
	        this.theme = source["theme"];
	        this.darkMode = source["darkMode"];
	        this.archiveOnDelete = source["archiveOnDelete"];
	        this.validExtensions = source["validExtensions"];
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
	    tertiary: SortColumn;
	    quaternary: SortColumn;
	
	    static createFrom(source: any = {}) {
	        return new ViewSort(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.primary = this.convertValues(source["primary"], SortColumn);
	        this.secondary = this.convertValues(source["secondary"], SortColumn);
	        this.tertiary = this.convertValues(source["tertiary"], SortColumn);
	        this.quaternary = this.convertValues(source["quaternary"], SortColumn);
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
	    sidebarWidth?: number;
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
	    dashboardTimeframe?: string;
	
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
	        this.sidebarWidth = source["sidebarWidth"];
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
	        this.dashboardTimeframe = source["dashboardTimeframe"];
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

export namespace validation {
	
	export class FieldError {
	    field: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new FieldError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.message = source["message"];
	    }
	}
	export class FieldWarning {
	    field: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new FieldWarning(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.field = source["field"];
	        this.message = source["message"];
	    }
	}
	export class ValidationResult {
	    errors?: FieldError[];
	    warnings?: FieldWarning[];
	
	    static createFrom(source: any = {}) {
	        return new ValidationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.errors = this.convertValues(source["errors"], FieldError);
	        this.warnings = this.convertValues(source["warnings"], FieldWarning);
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

