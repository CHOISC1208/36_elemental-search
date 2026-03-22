-- prefecture の値の分布確認（おかしい値が残っていないか）
SELECT prefecture, COUNT(*) AS cnt
FROM "36_elemental-search".schools
GROUP BY prefecture
ORDER BY cnt DESC;

-- "の" が含まれる壊れた値が残っていないか確認
SELECT school_id, name, prefecture, address
FROM "36_elemental-search".schools
WHERE prefecture LIKE '%の%'
LIMIT 50;

-- 都/道/府/県 が末尾に残っている値がないか確認
SELECT school_id, name, prefecture, address
FROM "36_elemental-search".schools
WHERE prefecture ~ '[都道府県]$'
LIMIT 50;
