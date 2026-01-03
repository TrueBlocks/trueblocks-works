import { Work, Collection, Organization, Submission } from './types';

// Sample data extracted from actual CSV exports

export const collections: Collection[] = [
  { collectionID: '10010', collectionName: 'Focus', type: 'Active', isStatus: true, statusList: 'Focus', nItems: 38 },
  { collectionID: '10020', collectionName: 'Active', type: 'Active', isStatus: true, statusList: 'Active', nItems: 41 },
  { collectionID: '10030', collectionName: 'Working', type: 'Active', isStatus: true, statusList: 'Working', nItems: 463 },
  { collectionID: '10040', collectionName: 'Resting', type: 'Active', isStatus: true, statusList: 'Resting', nItems: 592 },
  { collectionID: '10050', collectionName: 'Waiting', type: 'Active', isStatus: true, statusList: 'Waiting', nItems: 66 },
  { collectionID: '20010', collectionName: 'Gestating', type: 'Process', isStatus: true, statusList: 'Gestating', nItems: 183 },
  { collectionID: '00090', collectionName: 'Out', type: 'Process', isStatus: true, statusList: 'Out', nItems: 0 },
  { collectionID: '60010', collectionName: 'Sleeping', type: 'Dead', isStatus: true, statusList: 'Sleeping', nItems: 189 },
  { collectionID: '60020', collectionName: 'Dying', type: 'Dead', isStatus: true, statusList: 'Dying', nItems: 48 },
  { collectionID: '60030', collectionName: 'Dead', type: 'Dead', isStatus: true, statusList: 'Dead', nItems: 99 },
  { collectionID: '40010', collectionName: 'Spiral', type: 'Book', isStatus: false, statusList: 'None', nItems: 50 },
  { collectionID: '40050', collectionName: 'Storey Cotton', type: 'Book', isStatus: false, statusList: 'None', nItems: 20 },
  { collectionID: '30020', collectionName: 'Math Essays', type: 'Other', isStatus: false, statusList: 'None', nItems: 23 },
  { collectionID: '30050', collectionName: 'Freewrite', type: 'Other', isStatus: false, statusList: 'None', nItems: 65 },
  { collectionID: '30060', collectionName: '365 Challenge', type: 'Other', isStatus: false, statusList: 'None', nItems: 124 },
];

export const works: Work[] = [
  { workID: 21244, title: "My Brother's Death", type: 'Essay', status: 'Resting', quality: 'Good', year: 1986, path: "100 Essays/bEssay - 1986 - My Brother's Death.docx", docType: 'docx', nWords: '2,055', isPrinted: true, isBlog: true, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '8/13/2020' },
  { workID: 21747, title: 'Alternative Sleeping Arrangements', type: 'Poem', status: 'Dying', quality: 'Bad', year: 1987, path: '100 Poems/ePoem - 1987 - Alternative Sleeping Arrangements.docx', docType: 'docx', nWords: '', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '5/3/2021' },
  { workID: 21026, title: "The Driver's Dead", type: 'Poem', status: 'Dying', quality: 'Bad', year: 1987, path: "100 Poems/ePoem - 1987 - The Driver's Dead.docx", docType: 'docx', nWords: '', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '' },
  { workID: 21312, title: 'Jay Rush - Uptight and Personal', type: 'Essay', status: 'Resting', quality: 'Okay', year: 1987, path: '100 Essays/cEssay - 1987 - Jay Rush - Uptight and Personal.docx', docType: 'docx', nWords: '611', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '1/28/2016' },
  { workID: 22175, title: 'On Living a Worthwhile Life', type: 'Essay', status: 'Resting', quality: 'Okay', year: 1987, path: '100 Essays/cEssay - 1987 - On Living a Worthwhile Life.docx', docType: 'docx', nWords: '188', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '' },
  { workID: 21005, title: 'The Chair', type: 'Essay', status: 'Resting', quality: 'Okay', year: 1987, path: '100 Essays/cEssay - 1987 - The Chair.docx', docType: 'docx', nWords: '441', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '' },
  { workID: 21142, title: 'Beer with a Prophet', type: 'Story', status: 'Resting', quality: 'Okay', year: 1987, path: '100 Stories/cStory - 1987 - Beer with a Prophet.docx', docType: 'docx', nWords: '', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '1/28/2016' },
  { workID: 21348, title: 'Goodbye', type: 'Song', status: 'Resting', quality: 'Okay', year: 1987, path: '100 Songs/cSong - 1987 - Goodbye.docx', docType: 'docx', nWords: '', isPrinted: true, isBlog: false, isRevised: true, isProsePoem: false, hasSound: true, accessDate: '' },
  { workID: 21623, title: 'Beverage Spillage Council', type: 'Essay', status: 'Resting', quality: 'Okay', year: 1989, path: '100 Essays/cEssay - 1989 - Beverage Spillage Council.docx', docType: 'docx', nWords: '1,047', isPrinted: true, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '' },
  { workID: 3691, title: 'Bend the Light', type: 'Story', status: 'Active', quality: 'Best', year: 2011, path: '150 Published/aaStory - 2011 - Bend the Light.docx', docType: 'docx', nWords: '500', isPrinted: true, isBlog: false, isRevised: true, isProsePoem: false, hasSound: false, accessDate: '12/14/2015' },
  { workID: 21181, title: 'Life as a Function', type: 'Poem', status: 'Active', quality: 'Best', year: 2015, path: '150 Published/aaPoem - 2015 - Life as a Function.docx', docType: 'docx', nWords: '120', isPrinted: true, isBlog: false, isRevised: true, isProsePoem: false, hasSound: true, accessDate: '5/20/2015' },
  { workID: 21146, title: 'The Morning Light', type: 'Poem', status: 'Working', quality: 'Good', year: 2024, path: '34 Current Work/bPoem - 2024 - The Morning Light.docx', docType: 'docx', nWords: '85', isPrinted: false, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '1/2/2026' },
  { workID: 21031, title: 'Fragments of Memory', type: 'Essay', status: 'Focus', quality: 'Better', year: 2025, path: '34 Current Work/bEssay - 2025 - Fragments of Memory.docx', docType: 'docx', nWords: '1,200', isPrinted: false, isBlog: false, isRevised: true, isProsePoem: false, hasSound: false, accessDate: '12/28/2025' },
  { workID: 21030, title: 'Winter Solstice', type: 'Poem', status: 'Focus', quality: 'Good', year: 2025, path: '34 Current Work/bPoem - 2025 - Winter Solstice.docx', docType: 'docx', nWords: '64', isPrinted: false, isBlog: false, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '12/21/2025' },
  { workID: 21668, title: 'New Year Intentions', type: 'Essay', status: 'Gestating', quality: 'Okay', year: 2026, path: '35 Open Ideas/cEssay Idea - 2026 - New Year Intentions.docx', docType: 'docx', nWords: '350', isPrinted: false, isBlog: true, isRevised: false, isProsePoem: false, hasSound: false, accessDate: '1/1/2026' },
];

export const organizations: Organization[] = [
  { orgID: 1399, name: 'Agni', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Best', accepts: '', url: 'http://www.bu.edu/agni/', otherURL: 'http://www.bu.edu/agni/submit.html', submissionTypes: 'online,snail mail', timing: '', ranking: 47, nPushPoetry: 19, nPushFiction: 28, nPushNonFiction: 42 },
  { orgID: 1338, name: 'American Poetry Review', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Best', accepts: 'poetry,cnf,reviews', url: 'http://www.aprweb.org/', otherURL: 'http://americanpoetryreview.submittable.com/submit', submissionTypes: 'snail mail,submittable', timing: '', ranking: 40, nPushPoetry: 74, nPushFiction: 0, nPushNonFiction: 7 },
  { orgID: 1739, name: 'Antioch Review', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Best', accepts: 'cnf,short fiction,poetry,reviews', url: 'http://antiochcollege.org/antioch_review/', otherURL: 'http://antiochcollege.org/antioch_review/guidelines.html', submissionTypes: 'snail mail', timing: '', ranking: 28, nPushPoetry: 0, nPushFiction: 29, nPushNonFiction: 15 },
  { orgID: 1411, name: 'Another Chicago Magazine', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Good', accepts: 'short fiction,poetry,cnf', url: 'http://www.anotherchicagomagazine.net/', otherURL: 'http://www.anotherchicagomagazine.net/submissions', submissionTypes: '', timing: '', ranking: 0, nPushPoetry: 0, nPushFiction: 3, nPushNonFiction: 1 },
  { orgID: 1423, name: 'The Atlantic Monthly', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Better', accepts: '', url: 'http://www.theatlantic.com/', otherURL: 'http://www.theatlantic.com/faq/#manuscript', submissionTypes: '', timing: '', ranking: 0, nPushPoetry: 0, nPushFiction: 0, nPushNonFiction: 0 },
  { orgID: 1066, name: 'Bamboo Ridge', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Good', accepts: '', url: 'http://www.bambooridge.com/', otherURL: 'http://www.bambooridge.com/submission.aspx', submissionTypes: '', timing: '', ranking: 0, nPushPoetry: 0, nPushFiction: 2, nPushNonFiction: 0 },
  { orgID: 1647, name: 'Bellevue Literary Review', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Good', accepts: '', url: 'http://blr.med.nyu.edu/', otherURL: 'http://blr.med.nyu.edu/submissions/', submissionTypes: '', timing: '', ranking: 0, nPushPoetry: 1, nPushFiction: 17, nPushNonFiction: 12 },
  { orgID: 1068, name: 'Blink-Ink', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Okay', accepts: 'flash fiction', url: 'http://www.blink-ink.com/', otherURL: 'http://www.blink-ink.com/submissions/', submissionTypes: '', timing: 'Quarterly', ranking: 0, nPushPoetry: 0, nPushFiction: 0, nPushNonFiction: 0 },
  { orgID: 1208, name: 'Every Day Fiction', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Good', accepts: 'flash fiction', url: 'http://www.everydayfiction.com/', otherURL: '', submissionTypes: 'online', timing: 'Daily', ranking: 0, nPushPoetry: 0, nPushFiction: 0, nPushNonFiction: 0 },
  { orgID: 1818, name: 'Stony Lane Press', otherName: '', type: 'Journal', status: 'Open', myInterest: 'Good', accepts: 'poetry', url: 'http://stonylanepress.com/', otherURL: '', submissionTypes: 'online', timing: '', ranking: 0, nPushPoetry: 0, nPushFiction: 0, nPushNonFiction: 0 },
];

export const submissions: Submission[] = [
  { submissionID: 40315, workID: 3691, orgID: 1831, submissionDate: '12/14/2015', queryDate: '', responseDate: '12/14/2015', responseType: 'Accepted', submissionType: 'email', draft: '10th', contestName: '', cost: '', webAddress: 'https://www.facebook.com/events/541040716050805/', userID: '', password: '' },
  { submissionID: 40160, workID: 21181, orgID: 1418, submissionDate: '1/9/2012', queryDate: '', responseDate: '1/23/2012', responseType: 'Accepted', submissionType: 'online', draft: '1st', contestName: '', cost: '', webAddress: 'http://flashfiction.net/2011/05/flash-guest-thomas-jay-rush-bend-the-light.php', userID: '', password: '' },
  { submissionID: 40308, workID: 21146, orgID: 1818, submissionDate: '5/20/2015', queryDate: '', responseDate: '5/20/2015', responseType: 'Accepted', submissionType: 'online', draft: '1st', contestName: '', cost: '', webAddress: 'http://stonylanepress.com/life-as-a-function/', userID: '', password: '' },
  { submissionID: 40185, workID: 21031, orgID: 1208, submissionDate: '7/15/2012', queryDate: '', responseDate: '7/15/2012', responseType: 'Accepted', submissionType: 'online', draft: '1st', contestName: '', cost: '', webAddress: 'http://www.everydayfiction.com/flashfictionblog/interview-matt-daly-has-edfs-top-story-for-june/', userID: '', password: '' },
  { submissionID: 40186, workID: 21030, orgID: 1208, submissionDate: '8/15/2012', queryDate: '', responseDate: '8/15/2012', responseType: 'Accepted', submissionType: 'online', draft: '1st', contestName: '', cost: '', webAddress: 'http://www.everydayfiction.com/flashfictionblog/interview-nicholas-lee-huff-has-edfs-top-story-for-july/', userID: '', password: '' },
  { submissionID: 40188, workID: 21668, orgID: 1208, submissionDate: '9/15/2012', queryDate: '', responseDate: '9/15/2012', responseType: 'Accepted', submissionType: 'online', draft: '1st', contestName: '', cost: '', webAddress: 'http://www.everydayfiction.com/flashfictionblog/interview-olivia-kate-cerrone-has-edfs-top-story-for-august-2012/', userID: '', password: '' },
  { submissionID: 40156, workID: 21142, orgID: 1129, submissionDate: '2/23/2011', queryDate: '3/29/2011', responseDate: '3/29/2011', responseType: 'Declined', submissionType: 'Email', draft: '1st', contestName: '', cost: '', webAddress: 'http://www.wix.com/pinionjournal/submissions', userID: '', password: '' },
  { submissionID: 40158, workID: 21348, orgID: 1014, submissionDate: '9/16/2011', queryDate: '9/22/2011', responseDate: '9/22/2011', responseType: 'Declined', submissionType: 'Online', draft: '1st', contestName: '', cost: '', webAddress: 'http://www.postcardshorts.com/info.html', userID: '', password: '' },
  { submissionID: 40297, workID: 21623, orgID: 1532, submissionDate: '3/26/2014', queryDate: '4/4/2014', responseDate: '', responseType: 'Pending', submissionType: 'email', draft: '1st', contestName: '', cost: '', webAddress: '', userID: '', password: '' },
  { submissionID: 40298, workID: 21244, orgID: 1532, submissionDate: '3/26/2014', queryDate: '4/4/2014', responseDate: '', responseType: 'Pending', submissionType: 'email', draft: '1st', contestName: '', cost: '', webAddress: '', userID: '', password: '' },
];

// Helper function to get year from path
export function getYearFromPath(path: string): string {
  const match = path.match(/\d{4}/);
  return match ? match[0] : '';
}

// Helper to get work by ID
export function getWorkById(id: number): Work | undefined {
  return works.find(w => w.workID === id);
}

// Helper to get org by ID
export function getOrgById(id: number): Organization | undefined {
  return organizations.find(o => o.orgID === id);
}

// Helper to get submissions for a work
export function getSubmissionsForWork(workId: number): Submission[] {
  return submissions.filter(s => s.workID === workId);
}
