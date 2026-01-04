package main

import "works/internal/models"

type EnumLists struct {
	StatusList   []string `json:"statusList"`
	QualityList  []string `json:"qualityList"`
	WorkTypeList []string `json:"workTypeList"`
}

func (a *App) GetEnumLists() EnumLists {
	return EnumLists{
		StatusList:   models.StatusList,
		QualityList:  models.QualityList,
		WorkTypeList: models.WorkTypeList,
	}
}
