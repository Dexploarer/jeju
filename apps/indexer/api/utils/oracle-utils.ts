/**
 * Oracle utilities
 * Shared business logic for oracle-related operations
 */

import { find, type OracleFeed, type OracleReport } from '../db'
import type { OracleFeedResponse, OracleReportResponse } from './response-utils'
import {
  mapOracleFeedResponse,
  mapOracleReportResponse,
} from './response-utils'
import { NotFoundError } from './types'

export interface OracleFeedDetail {
  feed: OracleFeedResponse
  recentReports: OracleReportResponse[]
}

/**
 * Get oracle feed details with recent reports
 */
export async function getOracleFeedDetail(
  feedId: string,
): Promise<OracleFeedDetail> {
  if (!feedId || feedId.trim().length === 0) {
    throw new Error('feedId is required and must be a non-empty string')
  }

  const feeds = await find<OracleFeed>('OracleFeed', {
    where: { feedId },
    take: 1,
  })

  const feed = feeds[0]
  if (!feed) {
    throw new NotFoundError('Oracle Feed', feedId)
  }

  const recentReports = await find<OracleReport>('OracleReport', {
    where: { feedId: feed.id },
    order: { timestamp: 'DESC' },
    take: 10,
  })

  return {
    feed: mapOracleFeedResponse(feed),
    recentReports: recentReports.map(mapOracleReportResponse),
  }
}
