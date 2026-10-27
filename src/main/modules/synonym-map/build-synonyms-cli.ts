import { getPool, closePool } from '../../database/pool'
import { BuildSynonymGroupsUseCase } from './synonym-builder.use-case'
import { MySqlSynonymRepository } from '../../database/repositories/mysql-synonym.repository'

async function runCli(): Promise<void> {
  const pool = getPool()
  const synonymRepo = new MySqlSynonymRepository(pool)
  const useCase = new BuildSynonymGroupsUseCase(pool, synonymRepo)

  try {
    console.log('=====================================================')
    console.log('   BẮT ĐẦU CHẠY PIPELINE BUILD TỪ ĐỒNG NGHĨA HSK')
    console.log('=====================================================')

    const result = await useCase.execute()

    console.log('\n--- BÁO CÁO TỔNG QUAN ---')
    console.log(`- Tổng số nhóm đồng nghĩa: ${result.totalGroups}`)
    console.log(`- Tổng số liên kết thành viên: ${result.totalMembers}`)
    console.log(`- Số nhóm tạo mới: ${result.inserted}`)
    console.log(`- Số nhóm cập nhật: ${result.updated}`)

    // Xuất mẫu 50 nhóm ngẫu nhiên để kiểm tra chất lượng
    console.log('\n--- XUẤT MẪU 50 NHÓM ĐỂ KIỂM TRA CHẤT LƯỢNG ---')
    const sampleGroups = await synonymRepo.listGroups({ page: 1, limit: 50 })
    sampleGroups.items.forEach((g, idx) => {
      const memberList = g.members
        .map((m) => `${m.word} (${m.pinyin}, HSK${m.hsk_level}${m.nuance_note ? ` - ${m.nuance_note}` : ''})`)
        .join(' | ')
      console.log(
        `#${idx + 1} [${g.root_gloss.toUpperCase()}] (Score: ${g.root_score}, ${g.members.length} từ): ${memberList}`
      )
    })

    console.log('\nPipeline hoàn tất thành công!')
  } catch (err) {
    console.error('Lỗi khi chạy BuildSynonymGroups:', err)
  } finally {
    await closePool()
    process.exit(0)
  }
}

if (process.argv.some((a) => a.includes('build-synonyms-cli'))) {
  runCli()
}
