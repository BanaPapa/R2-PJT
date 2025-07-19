import { MVP_CONFIG, type PriceData } from '../config';

// Generate sample price data for MVP
export function generateSampleData(): PriceData[] {
  const data: PriceData[] = [];
  const baseDate = new Date('2023-01-01');
  
  MVP_CONFIG.SAMPLE_REGIONS.forEach((region) => {
    let basePrice = 100 + Math.random() * 50; // Random starting price index
    
    for (let i = 0; i < MVP_CONFIG.DATA_POINTS_PER_REGION; i++) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() + i);
      
      // Simulate price fluctuation
      const fluctuation = (Math.random() - 0.5) * 10;
      basePrice += fluctuation;
      
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