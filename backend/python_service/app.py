# backend/python_service/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import PyPDF2
import pdfplumber
import spacy
import io
import os
import sys
import json
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

# Load NLP model
try:
    nlp = spacy.load("en_core_web_sm")
except:
    nlp = None
    print("⚠ spaCy model not loaded — install with: python -m spacy download en_core_web_sm")

# ─────────────────────────────────────────────
# SKILLS DATABASE
# ─────────────────────────────────────────────
JOB_ROLES = {
    "data analyst":        ["python", "sql", "excel", "power bi", "tableau", "statistics",
                            "machine learning", "data visualization", "pandas", "numpy"],
    "web developer":       ["html", "css", "javascript", "react", "node.js", "mongodb",
                            "typescript", "rest api", "git", "responsive design"],
    "software engineer":   ["java", "python", "data structures", "algorithms", "git",
                            "oop", "system design", "unit testing", "sql", "problem solving"],
    "machine learning engineer": ["python", "tensorflow", "pytorch", "scikit-learn",
                            "deep learning", "nlp", "computer vision", "statistics",
                            "pandas", "model deployment"],
    "ui/ux designer":      ["figma", "adobe xd", "wireframing", "prototyping",
                            "user research", "design systems", "css", "accessibility",
                            "sketch", "usability testing"],
    "devops engineer":     ["docker", "kubernetes", "aws", "ci/cd", "linux",
                            "terraform", "jenkins", "git", "bash scripting", "monitoring"],
    "android developer":   ["java", "kotlin", "android sdk", "xml", "firebase",
                            "rest api", "git", "mvvm", "room database", "material design"],
    "ios developer":       ["swift", "objective-c", "xcode", "uikit", "swiftui",
                            "core data", "rest api", "git", "mvvm", "app store deployment"],
    "cybersecurity analyst": ["network security", "ethical hacking", "penetration testing",
                            "siem", "firewalls", "python", "linux", "vulnerability assessment",
                            "cryptography", "incident response"],
    "cloud engineer":      ["aws", "azure", "gcp", "terraform", "docker", "kubernetes",
                            "networking", "linux", "python", "cost optimization"],
    "full stack developer": ["html", "css", "javascript", "react", "node.js", "sql",
                            "mongodb", "rest api", "git", "docker"],
    "data scientist":      ["python", "r", "machine learning", "statistics", "sql",
                            "data visualization", "deep learning", "pandas",
                            "feature engineering", "model evaluation"],
    "backend developer":   ["node.js", "python", "java", "sql", "mongodb",
                            "rest api", "microservices", "git", "docker", "system design"],
    "frontend developer":  ["html", "css", "javascript", "react", "typescript",
                            "git", "responsive design", "rest api", "figma",
                            "performance optimization"],
    "product manager":     ["product roadmap", "agile", "user research", "jira",
                            "data analysis", "stakeholder management", "wireframing",
                            "a/b testing", "communication", "market research"],
}

# ─────────────────────────────────────────────
# CAREER RECOMMENDER — 60 careers, TF-IDF + Keyword Hybrid
# ─────────────────────────────────────────────
CAREER_DATA = """career,skills,category
Data Scientist,python machine learning statistics data analysis pandas numpy scikit-learn deep learning sql visualization regression classification clustering,Data & AI
Machine Learning Engineer,python tensorflow pytorch deep learning neural networks computer vision nlp model deployment mlops feature engineering optimization,Data & AI
Data Analyst,sql excel data visualization tableau power bi statistics python pandas reporting dashboards business intelligence kpi metrics,Data & AI
AI Research Scientist,python deep learning research mathematics optimization algorithms neural networks pytorch transformers reinforcement learning paper writing,Data & AI
Data Engineer,python sql spark hadoop etl pipeline data warehousing airflow kafka cloud databricks dbt data lake ingestion,Data & AI
Business Intelligence Developer,sql tableau power bi data visualization reporting dashboards excel business analysis olap data modeling kpi analytics,Data & AI
NLP Engineer,python nlp text processing transformers bert gpt huggingface machine learning linguistics sentiment analysis named entity recognition,Data & AI
Computer Vision Engineer,python opencv deep learning image processing cnn pytorch tensorflow object detection image segmentation yolo face recognition,Data & AI
MLOps Engineer,python mlflow kubeflow docker kubernetes model monitoring ci cd feature store model registry devops cloud deployment,Data & AI
AI Product Manager,product management ai ml data strategy roadmap user research agile stakeholder analytics python sql business,Data & AI
Full Stack Developer,html css javascript react nodejs python sql git rest api mongodb express typescript webpack deployment,Software Development
Frontend Developer,html css javascript react angular vuejs typescript responsive design figma ui ux webpack accessibility performance,Software Development
Backend Developer,python java nodejs sql rest api microservices docker kubernetes databases system design caching authentication authorization,Software Development
Mobile App Developer,react native flutter android ios swift kotlin java mobile ui ux firebase api integration push notifications,Software Development
DevOps Engineer,docker kubernetes linux bash scripting ci cd jenkins git cloud aws terraform ansible monitoring logging prometheus,Software Development
Cloud Architect,aws azure gcp cloud infrastructure terraform networking security devops microservices serverless cost optimization iac,Software Development
Software Architect,system design microservices distributed systems java python api design patterns cloud scalability performance reliability,Software Development
Blockchain Developer,solidity ethereum smart contracts web3 javascript python cryptography defi nft hardhat truffle consensus,Software Development
Game Developer,unity c# game design graphics programming physics simulation unreal engine 3d animation shaders gameplay,Software Development
Embedded Systems Engineer,c c++ microcontrollers arduino raspberry pi rtos hardware programming electronics iot firmware debugging,Engineering
Site Reliability Engineer,linux sre monitoring alerting incident management slo sla python golang kubernetes docker on-call reliability,Software Development
API Developer,rest api graphql nodejs python flask django fastapi swagger openapi authentication rate limiting versioning,Software Development
Cybersecurity Analyst,network security ethical hacking penetration testing linux firewalls cryptography siem threat analysis vulnerability assessment,Cybersecurity
Security Engineer,devsecops application security code review vulnerability scanning sast dast aws security iam zero trust cloud,Cybersecurity
Incident Response Analyst,forensics malware analysis threat hunting siem splunk incident management network security log analysis,Cybersecurity
UI UX Designer,figma adobe xd sketch wireframing prototyping user research usability testing design thinking css html interaction design,Design
Graphic Designer,photoshop illustrator indesign figma typography branding visual design color theory print digital layout,Design
Motion Designer,after effects premiere pro animation motion graphics 3d cinema4d visual effects storytelling video editing,Design
Product Designer,figma product thinking user research prototyping design systems accessibility ui ux visual design stakeholder,Design
Web Designer,html css figma adobe xd wordpress responsive design ui ux typography visual design branding,Design
Product Manager,agile scrum product roadmap user stories market research analytics communication leadership stakeholder management okr prioritization,Management
Project Manager,agile scrum project planning risk management communication leadership ms project budget tracking waterfall pmp stakeholder,Management
Business Analyst,requirements gathering sql excel business process modeling stakeholder management documentation reporting process improvement bpmn,Management
Scrum Master,agile scrum kanban facilitation coaching team management sprint planning retrospective jira confluence servant leadership,Management
Program Manager,program planning portfolio management budgeting executive communication risk dependencies cross-functional leadership strategy,Management
Digital Marketing Specialist,seo sem social media content marketing google analytics email marketing ppc copywriting paid ads conversion,Marketing
Content Writer,writing research seo wordpress cms editing storytelling social media content strategy blogs articles copywriting,Marketing
SEO Specialist,seo technical seo keyword research backlinks content optimization google search console analytics rank tracking,Marketing
Data-Driven Marketer,google analytics python sql a/b testing attribution marketing analytics crm segmentation email automation roi,Marketing
Social Media Manager,social media content creation instagram linkedin twitter community management analytics paid campaigns brand voice,Marketing
Network Engineer,networking tcp ip routing switching cisco linux firewalls vpn security protocols bgp ospf network design,IT Infrastructure
Database Administrator,sql mysql postgresql oracle database design query optimization backup recovery performance tuning replication high availability,IT Infrastructure
System Administrator,linux windows servers networking bash scripting active directory cloud monitoring security patch management virtualization,IT Infrastructure
Cloud Support Engineer,aws azure gcp cloud infrastructure troubleshooting networking security iam support ticketing linux windows,IT Infrastructure
IT Support Specialist,helpdesk windows active directory networking hardware troubleshooting ticketing system administration customer service,IT Infrastructure
Financial Analyst,excel financial modeling valuation accounting bloomberg python sql risk analysis reporting forecasting budgeting,Finance
Quantitative Analyst,python r statistics mathematics financial modeling machine learning stochastic calculus risk derivatives pricing,Finance
Risk Analyst,risk management excel python statistics financial modeling regulatory compliance reporting stress testing scenario analysis,Finance
FinTech Developer,python javascript api banking payments blockchain sql rest api security compliance financial systems integration,Finance
Actuary,statistics mathematics probability excel r python risk insurance financial modeling regulatory reporting stochastic,Finance
Mechanical Engineer,cad solidworks ansys thermodynamics fluid mechanics materials science manufacturing design simulation fea,Engineering
Civil Engineer,autocad structural analysis project management construction materials surveying building codes revit bim planning,Engineering
Electrical Engineer,circuit design pcb electronics power systems matlab signal processing microcontrollers cad simulation testing,Engineering
Robotics Engineer,ros python c++ control systems kinematics sensors actuators computer vision simulation path planning,Engineering
Biomedical Engineer,matlab python medical devices fda regulations signal processing imaging biomechanics clinical trials,Engineering
HR Manager,recruitment talent management employee relations payroll hr software communication leadership organizational development hris,Human Resources
HR Data Analyst,python sql excel people analytics hr metrics workforce planning tableau power bi reporting attrition,Human Resources
Operations Manager,supply chain logistics process improvement lean six sigma operations management erp systems kpi forecasting,Management
Research Scientist,python r statistics experimental design data analysis scientific writing laboratory research hypothesis testing,Research
Bioinformatics Scientist,python r bioinformatics genomics machine learning statistics biology data analysis biopython sequencing,Research
Technical Writer,documentation api writing markdown git developer tools user manuals specifications technical communication tools,Other"""

# Build model at startup
_df = pd.read_csv(io.StringIO(CAREER_DATA))
_df['skills_clean'] = _df['skills'].str.lower().str.strip()
_df['skill_set'] = _df['skills_clean'].apply(lambda x: set(x.split()))

_vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english',
                               max_features=1000, sublinear_tf=True)
_tfidf_matrix = _vectorizer.fit_transform(_df['skills_clean'])

print(f"✅ Career recommender loaded: {len(_df)} careers")


def _keyword_overlap(user_set, career_set):
    if not user_set:
        return 0.0
    return len(user_set & career_set) / len(user_set)


def _hybrid(cos_s, over_s, alpha=0.65):
    return alpha * cos_s + (1 - alpha) * over_s


def _diversity_rerank(results, max_per_cat=4):
    seen = {}
    primary, overflow = [], []
    for r in results:
        cat = r['category']
        if seen.get(cat, 0) < max_per_cat:
            primary.append(r)
            seen[cat] = seen.get(cat, 0) + 1
        else:
            overflow.append(r)
    return (primary + overflow)[:15]


def recommend_careers(user_skills, top_n=15):
    if not user_skills or not user_skills.strip():
        return []
    user_clean = user_skills.lower().strip()
    user_set = set(user_clean.split())
    user_vec = _vectorizer.transform([user_clean])
    cos_scores = cosine_similarity(user_vec, _tfidf_matrix).flatten()
    over_scores = np.array([_keyword_overlap(user_set, cs) for cs in _df['skill_set']])
    final = np.array([_hybrid(cos_scores[i], over_scores[i]) for i in range(len(_df))])
    top_idx = final.argsort()[::-1][:min(top_n * 2, len(_df))]
    candidates = []
    for idx in top_idx:
        score = float(final[idx])
        if score < 0.01:
            continue
        skill_list = _df.iloc[idx]['skills'].split()
        matched = [s for s in skill_list if any(u in s or s in u for u in user_set)]
        candidates.append({
            'career':          _df.iloc[idx]['career'],
            'category':        _df.iloc[idx]['category'],
            'match_score':     round(score * 100, 1),
            'cosine_score':    round(float(cos_scores[idx]) * 100, 1),
            'overlap_score':   round(float(over_scores[idx]) * 100, 1),
            'required_skills': skill_list[:12],
            'matched_skills':  matched[:8],
        })
    diverse = _diversity_rerank(candidates)
    for i, r in enumerate(diverse, 1):
        r['rank'] = i
    return diverse


# ─────────────────────────────────────────────
# PDF HELPERS
# ─────────────────────────────────────────────
def extract_text_from_pdf(file_bytes):
    text = ""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        if len(text.strip().split()) > 30:
            return text
    except Exception:
        pass
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted
    except Exception:
        pass
    return text


def extract_skills(text, skills_list):
    found = []
    text_lower = text.lower()
    for skill in skills_list:
        if skill.lower() in text_lower:
            found.append(skill)
    return found


def analyze_resume(resume_text, role):
    role = role.lower().strip()
    matched_role = role if role in JOB_ROLES else None
    if not matched_role:
        for r in JOB_ROLES:
            if r in role or role in r:
                matched_role = r
                break
    if not matched_role:
        return {
            "matched_role": role, "required_skills": [],
            "matched_skills": [], "missing_skills": [],
            "match_pct": 0, "role_found": False
        }
    required = JOB_ROLES[matched_role]
    found = extract_skills(resume_text, required)
    missing = list(set(required) - set(found))
    match_pct = round((len(found) / len(required)) * 100) if required else 0
    return {
        "matched_role": matched_role, "required_skills": required,
        "matched_skills": found, "missing_skills": missing,
        "match_pct": match_pct, "role_found": True
    }


# ─────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────

@app.route('/extract', methods=['POST'])
def extract():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    role = request.form.get('role', '')
    try:
        file_bytes = file.read()
        text = extract_text_from_pdf(file_bytes)
        word_count = len(text.split())
        if word_count < 30:
            return jsonify({"error": "Could not extract enough text from PDF"}), 400
        skill_analysis = analyze_resume(text, role)
        return jsonify({"text": text, "word_count": word_count, "skill_analysis": skill_analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/skills/<role>', methods=['GET'])
def get_skills(role):
    role = role.lower()
    skills = JOB_ROLES.get(role, [])
    return jsonify({"role": role, "skills": skills})


@app.route('/roles', methods=['GET'])
def get_roles():
    return jsonify({"roles": list(JOB_ROLES.keys())})


@app.route('/api/career-recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    if not data or 'skills' not in data:
        return jsonify({'error': 'Missing skills field'}), 400
    user_skills = data.get('skills', '').strip()
    if not user_skills:
        return jsonify({'error': 'Skills cannot be empty'}), 400
    results = recommend_careers(user_skills, top_n=15)
    user_set = set(user_skills.lower().split())
    for r in results:
        r['matched_skills'] = [s for s in r.get('required_skills', []) 
                               if any(u in s or s in u for u in user_set)]
    return jsonify({
        'query': user_skills,
        'total_results': len(results),
        'recommendations': results
    })


if __name__ == '__main__':
    print("✅ Python microservice running on http://localhost:5000")
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))