import React, { useState } from "react";

const SearchBox = ({ onSearch }) => {
    const [keyword, setKeyword] = useState("");

    const handleSearch = () => {
        if (!window.kakao || !window.kakao.maps || !keyword) return;

        const ps = new window.kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
                const { y, x, place_name } = data[0];
                onSearch({ lat: parseFloat(y), lng: parseFloat(x), name: place_name});
            } else {
                alert("검색 결과가 없습니다.");
            }
        });
    };

    return (
        <div style={{ position: 'absolute', zIndex: 10, top: 10, left: 10, padding: 8, background: 'white', borderRadius: 4}}>
            <input
                type="text"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="장소를 검색하세요."
                style={{ padding: 4 }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                }}
            />
            <button onClick={handleSearch} style={{ marginLeft: 4}} />
        </div>
    );
};

export default SearchBox;