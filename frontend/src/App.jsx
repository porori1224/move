// 앱의 루트 컴포넌트
// - 전 화면을 덮는 카카오 지도(KakaoMap)
// - 좌측 상단 검색 박스(SearchBox)
// - 우측 하단 플로팅 버튼(FloatingButtons)
import './App.css'
import KakaoMap from './components/KakaoMap'
import SearchBox from './components/SearchBox'
import FloatingButtons from './components/FloatingButtons'
import { useEffect, useState } from 'react'
import OrgSelectModal from './components/OrgSelectModal'
import OrgSelectButton from './components/OrgSelectButton'

function App() {
  // 초기 렌더링 시 기관 선택 모달 표시 (선택된 기관이 로컬에 없을 때)
  const [org, setOrg] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('selectedOrg') || ''
    setOrg(saved)
    setShowModal(!saved)
  }, [])

  const handleSelect = (next) => {
    setOrg(next)
    // 선택 즉시 저장 후 모달 닫기
    if (next) {
      try { localStorage.setItem('selectedOrg', next) } catch {}
      setShowModal(false)
    }
  }

  const handleClose = () => {
    if (org) localStorage.setItem('selectedOrg', org)
    setShowModal(false)
  }

  // 단순 배치만 담당하며, 로직은 각 컴포넌트 내부에 캡슐화되어 있습니다.
  return (
    <>
      <KakaoMap />
      <SearchBox />
      <FloatingButtons />
      <OrgSelectButton onToggle={() => setShowModal(v => !v)} />
      <OrgSelectModal open={showModal} defaultOrg={org} onSelect={handleSelect} onClose={handleClose} />
    </>
  )
}

export default App
