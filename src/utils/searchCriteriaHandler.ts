
export class SearchCriteriaHandler {
    static handleSearchCriteria(params: { searchCriteria: string, searchValue: string}[]): string {
        const searchUrl = params.map(param => {
            return `&${param.searchCriteria}=${param.searchValue}`;
        }).join('');
        return searchUrl;
    }
}