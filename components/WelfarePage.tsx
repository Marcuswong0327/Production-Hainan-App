import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Badge } from '../ui/badge';
import { ArrowLeft, FileText, CheckCircle2, X, HeartHandshake, AlertCircle } from 'lucide-react';

interface Child {
  name: string;
  gender: string;
  age: string;
  occupationOrSchool: string;
  monthlyIncome: string;
}

interface WelfareApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  
  // Applicant Info
  applicantNameChinese: string;
  applicantNameEnglish: string;
  icNumber: string;
  age: string;
  gender: string;
  membershipNumber: string;
  joinDate: string;
  occupation: string;
  monthlyIncome: string;
  address: string;
  postcode: string;
  homePhone: string;
  mobilePhone: string;
  
  // Spouse Info
  spouseNameChinese: string;
  spouseNameEnglish: string;
  spouseAge: string;
  spouseOccupation: string;
  spouseMonthlyIncome: string;
  
  // Children
  children: Child[];
  
  // Questions
  hasMedicalInsurance: 'yes' | 'no';
  insuranceCompany: string;
  hasOtherWelfareAid: 'yes' | 'no';
  otherWelfareOrg: string;
  requestType: 'general_welfare' | 'sub_association_donation';
  
  // Application Reason
  applicationReason: string;
  
  // Files
  medicalDocument?: string; // Base64 or file name
  recommendationLetter?: string; // Base64 or file name
  
  // Sub Association
  recommendedBySubAssociation?: string;
  rejectionReason?: string;
}

export function WelfarePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState<'intro' | 'form' | 'success' | 'progress'>('intro');
  const [consentGiven, setConsentGiven] = useState(false);
  const [applications, setApplications] = useState<WelfareApplication[]>([]);

  // Form state
  const [formData, setFormData] = useState<Partial<WelfareApplication>>({
    applicantNameChinese: '',
    applicantNameEnglish: '',
    icNumber: '',
    age: '',
    gender: '',
    membershipNumber: '',
    joinDate: '',
    occupation: '',
    monthlyIncome: '',
    address: '',
    postcode: '',
    homePhone: '',
    mobilePhone: '',
    spouseNameChinese: '',
    spouseNameEnglish: '',
    spouseAge: '',
    spouseOccupation: '',
    spouseMonthlyIncome: '',
    children: [],
    hasMedicalInsurance: 'no',
    insuranceCompany: '',
    hasOtherWelfareAid: 'no',
    otherWelfareOrg: '',
    requestType: 'general_welfare',
    applicationReason: '',
  });

  const [medicalDoc, setMedicalDoc] = useState<File | null>(null);
  const [recommendationDoc, setRecommendationDoc] = useState<File | null>(null);
  const [subAssociations, setSubAssociations] = useState<any[]>([]);

  useEffect(() => {
    // Load user's previous applications
    const saved = localStorage.getItem('myHainanWelfareApplications');
    if (saved) {
      const allApplications = JSON.parse(saved);
      const userApplications = allApplications.filter((a: any) => a.userId === user?.id);
      setApplications(userApplications);
      
      // If user has applications, show progress view
      if (userApplications.length > 0 && step === 'intro') {
        // Keep intro as default, but allow them to see progress
      }
    }

    // Load sub associations
    const assocs = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
    setSubAssociations(assocs);
  }, [user, step]);

  const handleAddChild = () => {
    setFormData({
      ...formData,
      children: [
        ...(formData.children || []),
        { name: '', gender: '', age: '', occupationOrSchool: '', monthlyIncome: '' },
      ],
    });
  };

  const handleRemoveChild = (index: number) => {
    const newChildren = [...(formData.children || [])];
    newChildren.splice(index, 1);
    setFormData({ ...formData, children: newChildren });
  };

  const handleChildChange = (index: number, field: keyof Child, value: string) => {
    const newChildren = [...(formData.children || [])];
    newChildren[index] = { ...newChildren[index], [field]: value };
    setFormData({ ...formData, children: newChildren });
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSubmit = async () => {
    if (!formData.applicantNameChinese || !formData.applicantNameEnglish || !formData.icNumber) {
      alert('请填写完整的申请人信息 (Please fill in complete applicant information)');
      return;
    }

    try {
      let medicalDocBase64 = '';
      let recommendationDocBase64 = '';

      if (medicalDoc) {
        medicalDocBase64 = await convertFileToBase64(medicalDoc);
      }
      if (recommendationDoc) {
        recommendationDocBase64 = await convertFileToBase64(recommendationDoc);
      }

      const newApplication: WelfareApplication = {
        id: Date.now().toString(),
        userId: user?.id || '',
        status: 'pending',
        submittedAt: new Date().toISOString(),
        applicantNameChinese: formData.applicantNameChinese || '',
        applicantNameEnglish: formData.applicantNameEnglish || '',
        icNumber: formData.icNumber || '',
        age: formData.age || '',
        gender: formData.gender || '',
        membershipNumber: formData.membershipNumber || '',
        joinDate: formData.joinDate || '',
        occupation: formData.occupation || '',
        monthlyIncome: formData.monthlyIncome || '',
        address: formData.address || '',
        postcode: formData.postcode || '',
        homePhone: formData.homePhone || '',
        mobilePhone: formData.mobilePhone || '',
        spouseNameChinese: formData.spouseNameChinese || '',
        spouseNameEnglish: formData.spouseNameEnglish || '',
        spouseAge: formData.spouseAge || '',
        spouseOccupation: formData.spouseOccupation || '',
        spouseMonthlyIncome: formData.spouseMonthlyIncome || '',
        children: formData.children || [],
        hasMedicalInsurance: formData.hasMedicalInsurance || 'no',
        insuranceCompany: formData.insuranceCompany || '',
        hasOtherWelfareAid: formData.hasOtherWelfareAid || 'no',
        otherWelfareOrg: formData.otherWelfareOrg || '',
        requestType: formData.requestType || 'general_welfare',
        applicationReason: formData.applicationReason || '',
        medicalDocument: medicalDocBase64,
        recommendationLetter: recommendationDocBase64,
        recommendedBySubAssociation: formData.recommendedBySubAssociation,
      };

      // Save to localStorage
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      allApplications.push(newApplication);
      localStorage.setItem('myHainanWelfareApplications', JSON.stringify(allApplications));

      // Notify super admin - create notification that will be shown to any super admin
      // Since we don't have a user list, we'll create a system-wide notification
      const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
      
      // Create a notification with a special marker for super admins
      const superAdminNotification = {
        id: Date.now().toString() + '_super_admin',
        userId: 'super_admin', // Special marker for super admin notifications
        title: 'New Welfare Application',
        message: `New welfare application from ${formData.applicantNameEnglish || formData.applicantNameChinese}. Status: Pending review.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'system',
        linkTo: 'welfare_application',
        applicationId: newApplication.id,
      };
      
      notifications.push(superAdminNotification);
      localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));

      setApplications([...applications, newApplication]);
      setStep('success');
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('提交失败，请重试 (Submission failed, please try again)');
    }
  };

  // Introduction Page
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
        <div className="max-w-3xl mx-auto">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>

          <Card className="shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HeartHandshake className="w-10 h-10 text-yellow-600" />
              </div>
              <CardTitle className="text-3xl mb-2">福利金申请</CardTitle>
              <CardTitle className="text-2xl text-gray-700">Welfare Fund Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">关于福利金计划</h3>
                    <h3 className="font-semibold text-blue-800 mb-2">About the Welfare Fund Program</h3>
                    <p className="text-sm text-blue-800 mb-2">
                      马来西亚海南会馆联合会福利金计划旨在帮助面临经济困难的个人或家庭。
                      The Malaysia Hainan Association Federation Welfare Fund Program aims to assist individuals or families facing financial difficulties.
                    </p>
                    <p className="text-sm text-blue-800">
                      我们致力于为会员提供必要的支持，帮助他们度过困难时期。
                      We are committed to providing necessary support to our members to help them through difficult times.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">申请资格 / Eligibility</h3>
                <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                  <li>必须是马来西亚海南会馆联合会会员 (Must be a member of Malaysia Hainan Association Federation)</li>
                  <li>面临经济困难 (Facing financial difficulties)</li>
                  <li>需要医疗援助或其他紧急援助 (Requiring medical assistance or other emergency aid)</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">所需文件 / Required Documents</h3>
                <ul className="space-y-2 text-sm text-gray-700 list-disc list-inside">
                  <li>医疗报告/证件 (Medical report/documents)</li>
                  <li>属会主席推荐信 (Recommendation letter from sub-association chairman)</li>
                  <li>完整的申请表 (Complete application form)</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                <div className="flex items-start gap-3 mb-4">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked: boolean) => setConsentGiven(checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor="consent" className="font-semibold cursor-pointer">
                      信息使用同意书 / Data Usage Consent
                    </Label>
                    <p className="text-sm text-gray-700 mt-2">
                      我同意马来西亚海南会馆联合会收集、使用和处理我在本申请中提供的个人信息，以便：
                      <br />
                      I consent to the Malaysia Hainan Association Federation collecting, using, and processing my personal information provided in this application for the purpose of:
                    </p>
                    <ul className="text-sm text-gray-700 mt-2 ml-4 list-disc">
                      <li>处理我的福利金申请 (Processing my welfare fund application)</li>
                      <li>评估我的申请资格 (Evaluating my application eligibility)</li>
                      <li>与我联系关于申请状态 (Contacting me regarding application status)</li>
                      <li>内部记录和报告 (Internal records and reporting)</li>
                    </ul>
                    <p className="text-sm text-gray-700 mt-2">
                      我理解我的信息将被保密处理，仅在必要时与相关工作人员和委员会成员分享。
                      <br />
                      I understand that my information will be kept confidential and shared only with relevant staff and committee members when necessary.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                {applications.length > 0 && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('progress')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    查看申请进度 / View Application Progress
                  </Button>
                )}
                <Button
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                  disabled={!consentGiven}
                  onClick={() => setStep('form')}
                >
                  开始申请 / Start Application
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Progress View
  if (step === 'progress') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Button variant="ghost" onClick={() => setStep('intro')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>我的申请进度 / My Application Progress</CardTitle>
              <CardDescription>查看您的福利金申请状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {applications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>您还没有提交任何申请 / You have not submitted any applications yet.</p>
                  <Button onClick={() => setStep('form')} className="mt-4">
                    Start New Application
                  </Button>
                </div>
              ) : (
                applications.map((app) => (
                  <Card key={app.id} className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {app.applicantNameEnglish || app.applicantNameChinese}
                          </h3>
                          <p className="text-sm text-gray-600">
                            提交日期 / Submitted: {new Date(app.submittedAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <Badge
                          variant={
                            app.status === 'approved'
                              ? 'default'
                              : app.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className={
                            app.status === 'approved'
                              ? 'bg-green-600'
                              : app.status === 'rejected'
                              ? 'bg-red-600'
                              : 'bg-yellow-600'
                          }
                        >
                          {app.status === 'approved'
                            ? '已批准 / Approved'
                            : app.status === 'rejected'
                            ? '已拒绝 / Rejected'
                            : '待审核 / Pending'}
                        </Badge>
                      </div>
                      
                      {app.status === 'rejected' && app.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded mb-3">
                          <p className="text-sm font-semibold text-red-900 mb-1">拒绝原因 / Rejection Reason:</p>
                          <p className="text-sm text-red-800">{app.rejectionReason}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">申请类型 / Request Type:</span>
                          <span className="ml-2 font-medium">
                            {app.requestType === 'general_welfare'
                              ? '总会福利基金拨款 / General Welfare Fund'
                              : '要求属会捐助 / Sub-Association Donation'}
                          </span>
                        </div>
                        {app.recommendedBySubAssociation && (
                          <div>
                            <span className="text-gray-600">推荐属会 / Recommended By:</span>
                            <span className="ml-2 font-medium">{app.recommendedBySubAssociation}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              <Button onClick={() => setStep('form')} className="w-full mt-4">
                Start New Application
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success Page
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Card className="shadow-xl">
            <CardContent className="pt-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">申请已提交！</h2>
              <h2 className="text-xl font-semibold text-gray-700 mb-4">Application Submitted!</h2>
              <p className="text-gray-600 mb-6">
                您的福利金申请已成功提交。我们的团队将尽快审核您的申请。
                <br />
                Your welfare fund application has been successfully submitted. Our team will review your application as soon as possible.
              </p>
              <div className="space-y-3">
                <Button onClick={() => setStep('progress')} className="w-full">
                  View Application Progress
                </Button>
                <Button variant="outline" onClick={onBack} className="w-full">
                  Back to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Form Page
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => setStep('intro')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">马来西亚海南会馆联合会</CardTitle>
                <CardTitle className="text-xl text-gray-700">申请福利金表格</CardTitle>
                <CardDescription>REV: 2</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Applicant Information */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-4">申请人资料 / Applicant Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>姓名 (中) / NAME (Chinese) *</Label>
                  <Input
                    value={formData.applicantNameChinese}
                    onChange={(e) => setFormData({ ...formData, applicantNameChinese: e.target.value })}
                    placeholder="请输入中文姓名"
                  />
                </div>
                <div>
                  <Label>姓名 (英) / NAME (English) *</Label>
                  <Input
                    value={formData.applicantNameEnglish}
                    onChange={(e) => setFormData({ ...formData, applicantNameEnglish: e.target.value })}
                    placeholder="Enter English name"
                  />
                </div>
                <div>
                  <Label>身份证号码 / Identity Card Number *</Label>
                  <Input
                    value={formData.icNumber}
                    onChange={(e) => setFormData({ ...formData, icNumber: e.target.value })}
                    placeholder="e.g., 123456-78-9012"
                  />
                </div>
                <div>
                  <Label>年龄 / Age</Label>
                  <Input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <Label>性别 / Gender</Label>
                  <Input
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    placeholder="Gender"
                  />
                </div>
                <div>
                  <Label>会馆会员编号 / Association Membership Number</Label>
                  <Input
                    value={formData.membershipNumber}
                    onChange={(e) => setFormData({ ...formData, membershipNumber: e.target.value })}
                    placeholder="Membership number"
                  />
                </div>
                <div>
                  <Label>加入会馆日期 / Date Joined Association</Label>
                  <Input
                    type="date"
                    value={formData.joinDate}
                    onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>职业 / Occupation</Label>
                  <Input
                    value={formData.occupation}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    placeholder="Occupation"
                  />
                </div>
                <div>
                  <Label>每月收入RM / Monthly Income RM</Label>
                  <Input
                    type="number"
                    value={formData.monthlyIncome}
                    onChange={(e) => setFormData({ ...formData, monthlyIncome: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-4">
                <div>
                  <Label>住家地址 / Home Address</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>邮区编号 / Postcode</Label>
                    <Input
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      placeholder="Postcode"
                    />
                  </div>
                  <div>
                    <Label>住家电话 / Home Phone</Label>
                    <Input
                      value={formData.homePhone}
                      onChange={(e) => setFormData({ ...formData, homePhone: e.target.value })}
                      placeholder="Home phone"
                    />
                  </div>
                  <div>
                    <Label>手机 / Mobile Phone</Label>
                    <Input
                      value={formData.mobilePhone}
                      onChange={(e) => setFormData({ ...formData, mobilePhone: e.target.value })}
                      placeholder="Mobile phone"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Spouse Information */}
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-4">配偶资料 / Spouse Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>姓名 (中) / NAME (Chinese)</Label>
                  <Input
                    value={formData.spouseNameChinese}
                    onChange={(e) => setFormData({ ...formData, spouseNameChinese: e.target.value })}
                    placeholder="Spouse Chinese name"
                  />
                </div>
                <div>
                  <Label>姓名 (英) / NAME (English)</Label>
                  <Input
                    value={formData.spouseNameEnglish}
                    onChange={(e) => setFormData({ ...formData, spouseNameEnglish: e.target.value })}
                    placeholder="Spouse English name"
                  />
                </div>
                <div>
                  <Label>年龄 / Age</Label>
                  <Input
                    type="number"
                    value={formData.spouseAge}
                    onChange={(e) => setFormData({ ...formData, spouseAge: e.target.value })}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <Label>职业 / Occupation</Label>
                  <Input
                    value={formData.spouseOccupation}
                    onChange={(e) => setFormData({ ...formData, spouseOccupation: e.target.value })}
                    placeholder="Occupation"
                  />
                </div>
                <div>
                  <Label>每月收入RM / Monthly Income RM</Label>
                  <Input
                    type="number"
                    value={formData.spouseMonthlyIncome}
                    onChange={(e) => setFormData({ ...formData, spouseMonthlyIncome: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Family Status - Children */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">家庭状况 / Family Status (Children)</h3>
                <Button type="button" size="sm" onClick={handleAddChild} variant="outline">
                  Add Child
                </Button>
              </div>
              <div className="space-y-4">
                {formData.children && formData.children.length > 0 ? (
                  formData.children.map((child, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium">Child {index + 1}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveChild(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>子女姓名 (中) / Children's Name (Chinese)</Label>
                          <Input
                            value={child.name}
                            onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                            placeholder="Name"
                          />
                        </div>
                        <div>
                          <Label>性别 / Gender</Label>
                          <Input
                            value={child.gender}
                            onChange={(e) => handleChildChange(index, 'gender', e.target.value)}
                            placeholder="Gender"
                          />
                        </div>
                        <div>
                          <Label>年龄 / Age</Label>
                          <Input
                            type="number"
                            value={child.age}
                            onChange={(e) => handleChildChange(index, 'age', e.target.value)}
                            placeholder="Age"
                          />
                        </div>
                        <div>
                          <Label>职业 / 就读学校 / Occupation / School Attending</Label>
                          <Input
                            value={child.occupationOrSchool}
                            onChange={(e) => handleChildChange(index, 'occupationOrSchool', e.target.value)}
                            placeholder="Occupation or school"
                          />
                        </div>
                        <div>
                          <Label>每月收入 / Monthly Income</Label>
                          <Input
                            type="number"
                            value={child.monthlyIncome}
                            onChange={(e) => handleChildChange(index, 'monthlyIncome', e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No children added</p>
                )}
              </div>
            </div>

            {/* Questions */}
            <div className="border-b pb-4 space-y-4">
              <h3 className="font-semibold text-lg mb-4">申请相关问题 / Application Questions</h3>
              
              <div>
                <Label className="mb-2 block">
                  1. 申请人有否投保医药保险？ / Does the applicant have medical insurance?
                </Label>
                <RadioGroup
                  value={formData.hasMedicalInsurance}
                  onValueChange={(value) => setFormData({ ...formData, hasMedicalInsurance: value as 'yes' | 'no' })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="insurance-yes" />
                    <Label htmlFor="insurance-yes">有 / Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="insurance-no" />
                    <Label htmlFor="insurance-no">没有 / No</Label>
                  </div>
                </RadioGroup>
                {formData.hasMedicalInsurance === 'yes' && (
                  <div className="mt-2">
                    <Label>如有,请注明保险公司名称 / If yes, please state the insurance company name</Label>
                    <Input
                      value={formData.insuranceCompany}
                      onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })}
                      placeholder="Insurance company name"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">
                  2. 申请人有否向其他福利团体申请援助金？ / Has the applicant applied for aid from other welfare organizations?
                </Label>
                <RadioGroup
                  value={formData.hasOtherWelfareAid}
                  onValueChange={(value) => setFormData({ ...formData, hasOtherWelfareAid: value as 'yes' | 'no' })}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="welfare-yes" />
                    <Label htmlFor="welfare-yes">有 / Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="welfare-no" />
                    <Label htmlFor="welfare-no">没有 / No</Label>
                  </div>
                </RadioGroup>
                {formData.hasOtherWelfareAid === 'yes' && (
                  <div className="mt-2">
                    <Label>如有,请注明福利团体名称 / If yes, please state the name of the welfare organization</Label>
                    <Input
                      value={formData.otherWelfareOrg}
                      onChange={(e) => setFormData({ ...formData, otherWelfareOrg: e.target.value })}
                      placeholder="Welfare organization name"
                    />
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">
                  3. 申请人要求 / Applicant's Request
                </Label>
                <RadioGroup
                  value={formData.requestType}
                  onValueChange={(value) => setFormData({ ...formData, requestType: value as any })}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="general_welfare" id="request-general" />
                    <Label htmlFor="request-general">总会福利基金拨款 / Allocation from the General Association Welfare Fund</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sub_association_donation" id="request-sub" />
                    <Label htmlFor="request-sub">要求属会捐助 / Request for donation from the affiliated association</Label>
                  </div>
                </RadioGroup>
                
                {formData.requestType === 'sub_association_donation' && (
                  <div className="mt-2">
                    <Label>推荐属会 / Recommended Sub-Association</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={formData.recommendedBySubAssociation || ''}
                      onChange={(e) => setFormData({ ...formData, recommendedBySubAssociation: e.target.value })}
                    >
                      <option value="">Select Sub-Association</option>
                      {subAssociations.map((assoc) => (
                        <option key={assoc.id} value={assoc.name || assoc.id}>
                          {assoc.name || assoc.id} {assoc.location ? `- ${assoc.location}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Application Reason */}
            <div className="border-b pb-4">
              <Label className="mb-2 block font-semibold">
                4. 申请原因 (包括病情,医药费所需若干,并附上医药报告/证件) / Reason for application (including illness, amount of medical expenses required, and attached medical report/documents)
              </Label>
              <Textarea
                value={formData.applicationReason}
                onChange={(e) => setFormData({ ...formData, applicationReason: e.target.value })}
                placeholder="Please provide detailed reason for application..."
                rows={5}
                className="resize-none"
              />
            </div>

            {/* File Attachments */}
            <div className="border-b pb-4 space-y-4">
              <h3 className="font-semibold text-lg mb-4">附件 / Attachments</h3>
              
              <div>
                <Label className="mb-2 block">
                  (一) 医药报告/证件 / Medical Report/Documents
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setMedicalDoc(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {medicalDoc && (
                    <Badge variant="outline" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {medicalDoc.name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>

              <div>
                <Label className="mb-2 block">
                  (二) 属会主席推荐信 / Recommendation Letter from Sub-Association Chairman
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setRecommendationDoc(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {recommendationDoc && (
                    <Badge variant="outline" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {recommendationDoc.name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, JPG, PNG, DOC, DOCX
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button variant="outline" onClick={() => setStep('intro')} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
