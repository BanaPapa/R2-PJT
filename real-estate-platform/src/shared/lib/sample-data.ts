import { MVP_CONFIG, type PriceData } from '../config';

// Generate sample price data for MVP
export function generateSampleData(): PriceData[] {
  const data: PriceData[] = [];
  // 현재 날짜에서 30개월 전부터 시작 (2025년 7월 기준 2023년 1월)
  const currentDate = new Date();
  const startDate = new Date(currentDate.getFullYear() - 2, 0, 1); // 2년 전 1월
  const monthsOfData = 30; // 30개월 데이터
  
  MVP_CONFIG.SAMPLE_REGIONS.forEach((region) => {
    let basePrice = 100 + Math.random() * 20; // 시작 지수
    
    for (let i = 0; i < monthsOfData; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      
      // 현재 날짜를 넘지 않도록 제한
      if (date > currentDate) break;
      
      // 더 현실적인 부동산 가격 변동 시뮬레이션
      const yearProgress = i / 12;
      const seasonalEffect = Math.sin((i % 12) * Math.PI / 6) * 2; // 계절적 변동
      const trendEffect = yearProgress * 5; // 연간 상승 트렌드
      const randomFluctuation = (Math.random() - 0.5) * 3;
      
      basePrice += seasonalEffect + trendEffect * 0.1 + randomFluctuation;
      
      // 지수가 너무 낮아지지 않도록 제한
      basePrice = Math.max(80, basePrice);
      
      data.push({
        date: date.toISOString().slice(0, 7), // YYYY-MM format
        priceIndex: Math.round(basePrice * 100) / 100,
        regionId: region.id,
      });
    }
  });
  
  return data;
}

// Sample data for immediate use
export const SAMPLE_PRICE_DATA = generateSampleData();