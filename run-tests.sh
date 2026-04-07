#!/bin/bash
API="http://localhost:3000"

# Wait for server ready
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "SERVER READY"
    break
  fi
  sleep 1
done

# STEP 1+2: Parse CV (already tested, skip if cached)
echo "=== TEST: parse-cv ==="
PARSE_RESULT=$(curl -s --max-time 30 -X POST "$API/api/parse-cv" \
  -H "Content-Type: application/json" \
  --data-raw '{"cvText":"NAME: Roy Okola Otieno\nEmail: royokola@email.com\nPhone: +254712345678\n\nPROFILE\nAgricultural and Biosystems Engineer passionate about renewable energy.\n\nEDUCATION\nJKUAT - BSc Agricultural and Biosystems Engineering (2018-2024)\n\nEXPERIENCE\nSolar Intern - Installed solar systems\nResearch Assistant - Electric mobility data\n\nSKILLS\nAutoCAD, Solar Design, Python\n\nCERTIFICATIONS\nElectric Mobility (2025)"}')
echo "$PARSE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print('parse-cv:', 'PASS' if d.get('success') else 'FAIL', '- model:', d.get('model'), '- cached:', d.get('cached'))" 2>/dev/null || echo "parse-cv: FAIL (parse error)"
echo "$PARSE_RESULT" > /home/z/my-project/test-parse.json

# STEP 3: Edge case - empty/short CV
echo "=== TEST: parse-cv edge case (too short) ==="
SHORT_RESULT=$(curl -s --max-time 10 -X POST "$API/api/parse-cv" \
  -H "Content-Type: application/json" \
  --data-raw '{"cvText":"Hello world"}')
echo "$SHORT_RESULT"
echo ""

# STEP 3b: Edge case - broken/garbled text
echo "=== TEST: parse-cv edge case (garbled) ==="
GARBLED_RESULT=$(curl -s --max-time 30 -X POST "$API/api/parse-cv" \
  -H "Content-Type: application/json" \
  --data-raw '{"cvText":"\x00\x01\x02\x03 random binary garbage \xff\xfe not a cv"}')
echo "$GARBLED_RESULT"
echo ""

# STEP 3c: Edge case - OCR-like messy text with missing headings
echo "=== TEST: parse-cv edge case (OCR messy / missing headings) ==="
MESSY_RESULT=$(curl -s --max-time 30 -X POST "$API/api/parse-cv" \
  -H "Content-Type: application/json" \
  --data-raw '{"cvText":"Chen Wei  chen.wei@example.com  +8613800138000\n\nBeijing, China\n\nSofware Enginer at Alibaba Cloud (2020-2024)\n- Led team of 5 to buid microservices platform\n- Redused API latency by 40% through caching optimization\n- Implmented CI/CD pipeline serving 200+ deployments/month\n\nTsinghua Universty\nBachelor of Computer Science (2016-2020)\nGPA: 3.8/4.0\n\nJava, Python, Kubernetes, Docker, MySQL, Redis, Spring Boot, AWS\n\nAWS Certified Solutions Architect (2022)"}')
echo "$MESSY_RESULT" > /home/z/my-project/test-parse-messy.json
echo "$MESSY_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('messy-parse:', 'PASS' if d.get('success') else 'FAIL')
if d.get('success'):
    cv=d['data']
    print('  name:', cv['personalInfo']['fullName'])
    print('  workExp count:', len(cv['workExperience']))
    for w in cv['workExperience']:
        print(f'    - {w[\"title\"]}: {len(w[\"bullets\"])} bullets')
    print('  edu count:', len(cv['education']))
    print('  skills count:', len(cv['skills']))
" 2>/dev/null || echo "messy-parse: FAIL (parse error)"

# STEP 4: Restructure CV (enhancement)
echo ""
echo "=== TEST: restructure-cv ==="
RESTRUCTURE_RESULT=$(curl -s --max-time 60 -X POST "$API/api/restructure-cv" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "parsedCv": {"personalInfo":{"fullName":"Roy Okola Otieno","location":"","email":"royokola@email.com","phone":"+254712345678","linkedin":"","github":"","website":""},"personalStatement":"Agricultural and Biosystems Engineer passionate about renewable energy.","projects":[],"workExperience":[{"dateRange":"","title":"Solar Intern","subtitle":"","bullets":["Installed solar systems"]},{"dateRange":"","title":"Research Assistant","subtitle":"","bullets":["Electric mobility data"]}],"education":[{"dateRange":"2018-2024","degree":"BSc Agricultural and Biosystems Engineering","institution":"JKUAT","grade":""}],"skills":[{"category":"Technical Skills","skills":"AutoCAD, Solar Design, Python"}]},
    "jobAnalysis":{"jobTitle":"Solar Design Engineer","company":"GreenTech Solutions","keyRequirements":["Solar system design","PV system sizing","AutoCAD proficiency","Renewable energy knowledge","Project management"],"preferredSkills":["PVSyst","HOMER","Python scripting","Electrical engineering background"],"requiredQualifications":["BSc in Engineering or related","2+ years solar experience","AutoCAD proficiency"],"preferredQualifications":["Professional engineering license","Masters degree"],"certifications":["NABCEP certification"],"experienceLevel":"junior","industry":"Renewable Energy","keywords":["solar design","PV systems","AutoCAD","renewable energy","electrical engineering"],"atsFilterKeywords":["solar design engineer","photovoltaic","PV system design","AutoCAD","PVSyst"],"competitionLevel":"medium","summary":"Solar Design Engineer role requiring PV system design expertise and AutoCAD proficiency."},
    "jobDescText":"We are looking for a Solar Design Engineer to join our team. The ideal candidate will have experience in designing photovoltaic systems, performing PV system sizing calculations, and creating detailed electrical drawings using AutoCAD. Requirements include a BSc in Engineering, 2+ years of experience in solar energy, and proficiency in AutoCAD. Preferred qualifications include NABCEP certification and experience with PVSyst software. The role involves designing residential and commercial solar installations, conducting site assessments, and preparing technical documentation."
  }')
echo "$RESTRUCTURE_RESULT" > /home/z/my-project/test-restructure.json
echo "$RESTRUCTURE_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('restructure:', 'PASS' if d.get('success') else 'FAIL', '- model:', d.get('model'), '- complexity:', d.get('complexity'))
if d.get('success'):
    cv=d['data']
    print('  personalStatement length:', len(cv.get('personalStatement','')))
    for w in cv.get('workExperience',[]):
        print(f'  workExp [{w.get(\"title\")}]: {len(w.get(\"bullets\",[]))} bullets')
        for b in w.get('bullets',[])[:2]:
            print(f'    - {b[:80]}...' if len(b)>80 else f'    - {b}')
" 2>/dev/null || echo "restructure: FAIL"

# STEP 5: Cover Letter
echo ""
echo "=== TEST: generate-cover-letter ==="
COVER_RESULT=$(curl -s --max-time 60 -X POST "$API/api/generate-cover-letter" \
  -H "Content-Type: application/json" \
  --data-raw '{
    "cvData": {"personalInfo":{"fullName":"Roy Okola Otieno","location":"","email":"royokola@email.com","phone":"+254712345678","linkedin":"","github":"","website":""},"personalStatement":"Agricultural and Biosystems Engineer passionate about renewable energy.","projects":[],"workExperience":[{"dateRange":"","title":"Solar Intern","subtitle":"","bullets":["Installed solar systems"]},{"dateRange":"","title":"Research Assistant","subtitle":"","bullets":["Electric mobility data"]}],"education":[{"dateRange":"2018-2024","degree":"BSc Agricultural and Biosystems Engineering","institution":"JKUAT","grade":""}],"skills":[{"category":"Technical Skills","skills":"AutoCAD, Solar Design, Python"}]},
    "jobAnalysis":{"jobTitle":"Solar Design Engineer","company":"GreenTech Solutions","keyRequirements":["Solar system design","PV system sizing","AutoCAD proficiency"],"preferredSkills":["PVSyst","Python scripting"],"requiredQualifications":["BSc in Engineering","2+ years solar experience"],"preferredQualifications":["NABCEP certification"],"certifications":["NABCEP"],"experienceLevel":"junior","industry":"Renewable Energy","keywords":["solar design","PV systems","AutoCAD","renewable energy"],"atsFilterKeywords":["solar design engineer","photovoltaic","PV system design"],"competitionLevel":"medium","summary":"Solar Design Engineer role."},
    "jobDescText":"We are looking for a Solar Design Engineer to join our team at GreenTech Solutions.",
    "formatId": "professional"
  }')
echo "$COVER_RESULT" > /home/z/my-project/test-cover-letter.json
echo "$COVER_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('cover-letter:', 'PASS' if d.get('success') else 'FAIL', '- model:', d.get('model'))
if d.get('success'):
    cl=d['data']
    print('  greeting:', cl.get('greeting',''))
    print('  opening:', cl.get('openingParagraph','')[:100])
    print('  body paragraphs:', len(cl.get('bodyParagraphs',[])))
    print('  closing:', cl.get('closingParagraph','')[:100])
    total_words = len((cl.get('greeting','') + cl.get('openingParagraph','') + ' '.join(cl.get('bodyParagraphs',[])) + cl.get('closingParagraph','')).split())
    print(f'  total words: {total_words}')
" 2>/dev/null || echo "cover-letter: FAIL"

# STEP 6: Analyze Job
echo ""
echo "=== TEST: analyze-job ==="
ANALYZE_RESULT=$(curl -s --max-time 30 -X POST "$API/api/analyze-job" \
  -H "Content-Type: application/json" \
  --data-raw '{"jobDescription":"We are seeking a Solar Design Engineer for GreenTech Solutions. Requirements: BSc Engineering, 2+ years solar experience, AutoCAD proficiency, PV system design knowledge. Preferred: NABCEP certification, PVSyst experience, Python scripting."}')
echo "$ANALYZE_RESULT" > /home/z/my-project/test-analyze-job.json
echo "$ANALYZE_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('analyze-job:', 'PASS' if d.get('success') else 'FAIL', '- model:', d.get('model'))
if d.get('success'):
    ja=d['data']
    print('  jobTitle:', ja.get('jobTitle'))
    print('  company:', ja.get('company'))
    print('  experienceLevel:', ja.get('experienceLevel'))
    print('  keywords:', ja.get('keywords',[]))
    print('  atsFilterKeywords:', ja.get('atsFilterKeywords',[]))
" 2>/dev/null || echo "analyze-job: FAIL"

# Health check API
echo ""
echo "=== TEST: health check ==="
HEALTH=$(curl -s --max-time 5 "$API/api")
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print('health:', 'PASS' if d.get('status')=='ok' else 'WARN', '- uptime:', d.get('uptime','?'))" 2>/dev/null || echo "health: FAIL"

echo ""
echo "=== ALL TESTS COMPLETED ==="
