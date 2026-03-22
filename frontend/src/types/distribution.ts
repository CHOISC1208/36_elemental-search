export interface PrefectureDistribution {
  prefecture: string
  public: number    // 公立
  private: number   // 私立
  national: number  // 国立
  total: number
}

export interface CityDistribution {
  city: string
  public: number
  private: number
  national: number
  total: number
}
