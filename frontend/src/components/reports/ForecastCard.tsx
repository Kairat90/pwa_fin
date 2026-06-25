import React from 'react'
import { TrendingUp, AlertCircle, Clock } from 'lucide-react'
import { Forecast } from '../../api/supabase'
import { cn } from '../../utils/cn'

interface ForecastCardProps {
  forecast: Forecast
}

export const ForecastCard: React.FC<ForecastCardProps> = ({ forecast }) => {
  const isPositive = forecast.projectedBalance >= 0
  const daysUntilZero = forecast.daysUntilZero

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Прогноз</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-500">Текущий баланс</p>
          <p className="text-xl font-bold text-gray-900">
            {forecast.currentBalance.toLocaleString()} KZT
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Средний доход в день</p>
          <p className="text-xl font-bold text-green-600">
            +{forecast.dailyIncome.toLocaleString()} KZT
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Средний расход в день</p>
          <p className="text-xl font-bold text-red-600">
            -{forecast.dailyExpense.toLocaleString()} KZT
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Прогноз через 30 дней</p>
          <p className={cn(
            'text-xl font-bold',
            isPositive ? 'text-green-600' : 'text-red-600'
          )}>
            {forecast.projectedBalance.toLocaleString()} KZT
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-4 flex-wrap">
          {daysUntilZero < 90 && daysUntilZero > 0 && (
            <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Денег хватит на {daysUntilZero} дней
              </span>
            </div>
          )}
          {daysUntilZero <= 0 && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Расходы превышают доходы!
              </span>
            </div>
          )}
          {daysUntilZero > 90 && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">
                Финансовая подушка более 3 месяцев
              </span>
            </div>
          )}
          {Number.isFinite(daysUntilZero) && (
            <div className="flex items-center gap-2 text-gray-500">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                При текущем темпе без дохода денег хватит на {Math.floor(daysUntilZero)} дней
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
